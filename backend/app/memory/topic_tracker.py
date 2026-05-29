from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.models.context_node import ContextNode
from app.models.candidate_topic import CandidateTopic
from app.models.context_edge import ContextEdge
from app.utils.embeddings import EmbeddingService
from app.core.llm import llm

# StrOutputParser returns raw generated text from the LLM
summary_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an AI context summarizer. Write a highly concise, 1-sentence personalized summary (under 15 words) of what the subtopic '{topic}' represents for the user in this conversation, based on their message: '{message}'. Do not start with generic phrases like 'The user wants to' or 'This node represents'. Focus purely on their specific focus. Example: 'Developing a RAG agent using LangChain and pinecone vector database.'"),
])
summary_chain = summary_prompt | llm | StrOutputParser()

def _levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        return _levenshtein(b, a)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(min(prev[j] + (ca != cb), prev[j+1] + 1, curr[j] + 1))
        prev = curr
    return prev[-1]


class TopicTracker:

    @staticmethod
    async def should_deduplicate(
        chat_uuid,
        new_label: str,
        existing_candidates: list[CandidateTopic],
        existing_nodes: list[ContextNode],
    ) -> tuple[bool, any]:
        """
        Returns (should_skip, matched_existing_or_None).
        Layer 1: fuzzy string matching for typos and substring containment.
        Layer 2: semantic embedding similarity for conceptual duplicates.
        """
        normalized_new = new_label.strip().lower()

        # ── Layer 1: Fuzzy / substring match ─────────────────────────────────
        all_existing_labels = (
            [(c.topic, c) for c in existing_candidates] +
            [(n.label, n) for n in existing_nodes]
        )

        for label, obj in all_existing_labels:
            normalized_existing = label.strip().lower()

            # Exact match after normalization
            if normalized_new == normalized_existing:
                return True, obj

            # One is a substring of the other (e.g. "RAG" in "RAG pipeline")
            if normalized_new in normalized_existing or normalized_existing in normalized_new:
                return True, obj

            # Levenshtein distance <= 2 for short strings (catches typos)
            if _levenshtein(normalized_new, normalized_existing) <= 2:
                return True, obj

        # ── Layer 2: Semantic embedding similarity ────────────────────────────
        if len(all_existing_labels) > 0:
            new_embedding = EmbeddingService.get_embedding(new_label)
            for label, obj in all_existing_labels:
                existing_embedding = obj.embedding if (hasattr(obj, "embedding") and obj.embedding) else EmbeddingService.get_embedding(label)
                similarity = EmbeddingService.cosine_similarity(new_embedding, existing_embedding)
                # Threshold 0.82 catches "information retrieval" vs "retrieval systems"
                if similarity >= 0.82:
                    return True, obj

        return False, None

    @staticmethod
    async def prune_candidates(db: AsyncSession, chat_uuid) -> None:
        PRUNE_TRIGGER_COUNT = 8       # start pruning when candidates exceed this
        LONG_CHAT_MESSAGE_COUNT = 20  # chat is "long" above this

        candidates_query = await db.execute(
            select(CandidateTopic).where(CandidateTopic.chat_id == chat_uuid)
        )
        candidates = candidates_query.scalars().all()

        if len(candidates) <= PRUNE_TRIGGER_COUNT:
            return  # nothing to prune yet

        # Sort: single-mention (never repeated) + oldest last_mentioned = prune first
        prune_candidates = sorted(
            [c for c in candidates if c.mention_count == 1],
            key=lambda c: c.last_mentioned,
        )

        # Remove enough to bring list back to PRUNE_TRIGGER_COUNT
        to_remove = len(candidates) - PRUNE_TRIGGER_COUNT
        for candidate in prune_candidates[:to_remove]:
            await db.delete(candidate)

        await db.flush()

    @staticmethod
    async def track_candidates(
        db: AsyncSession,
        chat_id,
        topics: list[str],
        user_message: str
    ):
        from uuid import UUID
        chat_uuid = UUID(str(chat_id)) if not isinstance(chat_id, UUID) else chat_id

        # Find root context node to compute semantic relevance
        root_node_query = await db.execute(
            select(ContextNode).where(
                ContextNode.chat_id == chat_uuid,
                ContextNode.node_type == "ROOT"
            )
        )
        root_node = root_node_query.scalars().first()
        if not root_node:
            return  # Need a root context planet first!

        root_embedding = root_node.embedding
        if not root_embedding:
            root_embedding = EmbeddingService.get_embedding(root_node.label)
            root_node.embedding = root_embedding
            db.add(root_node)
            await db.flush()

        # Find all nodes to deduplicate
        all_nodes_query = await db.execute(
            select(ContextNode).where(ContextNode.chat_id == chat_uuid)
        )
        existing_nodes = all_nodes_query.scalars().all()

        # Find all existing candidates to deduplicate
        all_candidates_query = await db.execute(
            select(CandidateTopic).where(CandidateTopic.chat_id == chat_uuid)
        )
        existing_candidates = list(all_candidates_query.scalars().all())

        # Determine crystallization threshold dynamically based on chat length
        from app.models.message import Message
        message_count_query = await db.execute(
            select(func.count(Message.id)).where(Message.chat_id == chat_uuid)
        )
        message_count = message_count_query.scalar() or 0
        is_long_chat = message_count >= 20
        crystallization_threshold = 5.0 if is_long_chat else 3.0

        for topic_name in topics:
            topic_name = topic_name.strip()
            if not topic_name or len(topic_name) < 3:
                continue

            should_skip, matched = await TopicTracker.should_deduplicate(
                chat_uuid, topic_name, existing_candidates, existing_nodes
            )

            if should_skip:
                if isinstance(matched, CandidateTopic):
                    matched.mention_count += 1.0
                    matched.last_mentioned = datetime.utcnow()
                    db.add(matched)
                    await db.flush()

                    # Crystallize when crossing the dynamic threshold
                    if matched.mention_count >= crystallization_threshold:
                        topic_embedding = matched.embedding or EmbeddingService.get_embedding(matched.topic)
                        await TopicTracker.crystallize_topic(
                            db, chat_uuid, matched, user_message, topic_embedding
                        )
                # If matched a node, do nothing as it's already crystallized!
                continue

            # New unique topic — insert fresh candidate
            topic_embedding = EmbeddingService.get_embedding(topic_name)
            
            # Calculate max similarity with ANY active node (root fallback)
            active_nodes = [n for n in existing_nodes if n.is_active]
            max_relevance = EmbeddingService.cosine_similarity(topic_embedding, root_embedding)
            for node in active_nodes:
                node_emb = node.embedding or EmbeddingService.get_embedding(node.label)
                sim = EmbeddingService.cosine_similarity(topic_embedding, node_emb)
                if sim > max_relevance:
                    max_relevance = sim
            relevance = max_relevance

            new_candidate = CandidateTopic(
                chat_id=chat_uuid,
                topic=topic_name,
                mention_count=1.0,
                semantic_relevance=relevance,
                persistence_score=relevance,
                embedding=topic_embedding,
                last_mentioned=datetime.utcnow()
            )
            db.add(new_candidate)
            await db.flush()
            existing_candidates.append(new_candidate)

        # Smart Pruning
        await TopicTracker.prune_candidates(db, chat_uuid)

        await db.flush()

    @staticmethod
    async def crystallize_topic(
        db: AsyncSession,
        chat_id,
        candidate: CandidateTopic,
        user_message: str,
        topic_embedding: list[float]
    ):
        from uuid import UUID
        chat_uuid = UUID(str(chat_id)) if not isinstance(chat_id, UUID) else chat_id

        # 1. Generate 1-sentence personalized summary
        try:
            summary = await summary_chain.ainvoke({
                "topic": candidate.topic,
                "message": user_message
            })
            summary = summary.strip()
        except Exception:
            summary = f"User is exploring details on {candidate.topic}."

        # 2. Find the most semantically similar active ContextNode as the parent
        nodes_query = await db.execute(
            select(ContextNode).where(
                ContextNode.chat_id == chat_uuid,
                ContextNode.is_active == True
            )
        )
        active_nodes = nodes_query.scalars().all()

        parent_node = None
        max_similarity = -1.0

        for node in active_nodes:
            node_emb = node.embedding
            if not node_emb:
                node_emb = EmbeddingService.get_embedding(node.label)
                node.embedding = node_emb
                db.add(node)
            sim = EmbeddingService.cosine_similarity(topic_embedding, node_emb)
            if sim > max_similarity:
                max_similarity = sim
                parent_node = node

        # Fallback to root context planet if similarity is weak or no nodes exist
        root_node = next((n for n in active_nodes if n.node_type == "ROOT"), None)
        if not parent_node or max_similarity < 0.4:
            parent_node = root_node
            if parent_node:
                max_similarity = EmbeddingService.cosine_similarity(
                    topic_embedding,
                    parent_node.embedding or EmbeddingService.get_embedding(parent_node.label)
                )

        parent_id = parent_node.id if parent_node else None
        depth_level = (parent_node.depth_level + 1.0) if parent_node else 1.0

        # Create ContextNode (Moon)
        new_node = ContextNode(
            chat_id=chat_uuid,
            parent_id=parent_id,
            label=candidate.topic,
            node_type="subtopic",
            priority="medium",
            created_by="system",
            frequency_score=candidate.mention_count,
            semantic_score=candidate.semantic_relevance,
            depth_score=1.0 / (depth_level + 1.0),
            activation_score=1.0,
            is_active=True,
            summary=summary,
            embedding=topic_embedding,
            depth_level=depth_level
        )
        db.add(new_node)
        await db.flush()

        # Create context edge from parent (primary orbit)
        if parent_node:
            edge = ContextEdge(
                source_node_id=parent_node.id,
                target_node_id=new_node.id,
                relationship_type="orbit",
                weight=max_similarity
            )
            db.add(edge)

        # Form secondary gravitational orbit links for cross-topic correlation (> 0.5)
        for node in active_nodes:
            if parent_node and node.id == parent_node.id:
                continue
            node_emb = node.embedding or EmbeddingService.get_embedding(node.label)
            sim = EmbeddingService.cosine_similarity(topic_embedding, node_emb)
            if sim >= 0.5:
                aux_edge = ContextEdge(
                    source_node_id=node.id,
                    target_node_id=new_node.id,
                    relationship_type="gravitational_orbit",
                    weight=sim
                )
                db.add(aux_edge)

        # Delete the candidate topic from buffer upon successful promotion
        await db.delete(candidate)
        await db.flush()
