from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import datetime

from app.models.context_node import ContextNode
from app.models.candidate_topic import CandidateTopic
from app.utils.embeddings import EmbeddingService

class ContextService:

    @staticmethod
    async def create_root_context(
        db: AsyncSession,
        chat_id,
        root_intent: str
    ):
        # Calculate local embedding for root context planet
        root_emb = EmbeddingService.get_embedding(root_intent)
        summary = f"Core workspace established to focus on {root_intent}."

        root_node = ContextNode(
            chat_id=chat_id,
            label=root_intent,
            node_type="ROOT",
            priority="HIGH",
            created_by="system",
            frequency_score=1.0,
            semantic_score=1.0,
            depth_score=0.0,
            activation_score=1.0,
            is_active=True,
            summary=summary,
            embedding=root_emb,
            depth_level=0.0
        )

        db.add(root_node)
        await db.flush()
        return root_node

    @staticmethod
    async def store_candidate_topics(
        db: AsyncSession,
        chat_id,
        topics: list[str]
    ):
        # Retrieve root context embedding for relevance calculations
        root_node_query = await db.execute(
            select(ContextNode).where(
                ContextNode.chat_id == chat_id,
                ContextNode.node_type == "ROOT"
            )
        )
        root_node = root_node_query.scalars().first()
        root_emb = root_node.embedding if root_node else None

        seen_topics = set()
        for topic in topics:
            topic = topic.strip()
            if not topic:
                continue
            topic_key = topic.lower()
            if topic_key in seen_topics:
                continue
            seen_topics.add(topic_key)

            existing_query = await db.execute(
                select(CandidateTopic).where(
                    CandidateTopic.chat_id == chat_id,
                    func.lower(CandidateTopic.topic) == topic_key
                )
            )
            existing = existing_query.scalars().first()

            topic_emb = EmbeddingService.get_embedding(topic)
            relevance = EmbeddingService.cosine_similarity(topic_emb, root_emb) if root_emb else 0.0

            if existing:
                existing.mention_count += 1.0
                existing.semantic_relevance = relevance
                existing.persistence_score = existing.mention_count * relevance
                existing.embedding = topic_emb
                existing.last_mentioned = datetime.utcnow()
                db.add(existing)
                continue

            candidate = CandidateTopic(
                chat_id=chat_id,
                topic=topic,
                mention_count=1.0,
                semantic_relevance=relevance,
                persistence_score=relevance,
                embedding=topic_emb,
                last_mentioned=datetime.utcnow()
            )
            db.add(candidate)

        await db.flush()
