from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.context_node import ContextNode
from app.utils.embeddings import EmbeddingService

class ContextManager:

    @staticmethod
    def calculate_score(node: ContextNode, query_similarity: float) -> float:
        # Priority Multipliers
        priority_map = {
            "high": 1.5,
            "medium": 1.0,
            "low": 0.5
        }
        priority_mult = priority_map.get(node.priority.lower(), 1.0)

        # Formula Terms
        semantic_term = query_similarity * 0.35
        frequency_term = min(node.frequency_score * 0.1, 1.0) * 0.25
        activation_term = node.activation_score * 0.20
        depth_term = (1.0 / (node.depth_level + 1.0)) * 0.20

        total_score = (semantic_term + frequency_term + activation_term + depth_term) * priority_mult
        return float(total_score)

    @staticmethod
    async def decay_memory(db: AsyncSession, chat_id):
        # 1. Decay activation scores of all active context nodes by 10% each message turn
        nodes_query = await db.execute(
            select(ContextNode).where(
                ContextNode.chat_id == chat_id,
                ContextNode.is_active == True
            )
        )
        active_nodes = nodes_query.scalars().all()

        for node in active_nodes:
            # Decay score
            node.activation_score = max(0.0, node.activation_score * 0.9)

            # Auto-archive if activation score falls below 0.15 OR if last mentioned > 3 months ago (90 days)
            age_limit = datetime.utcnow() - timedelta(days=90)
            if node.node_type != "ROOT":  # Keep Root node active always
                if node.activation_score < 0.15 or (node.last_mentioned and node.last_mentioned < age_limit):
                    node.is_active = False

            db.add(node)
        await db.flush()

    @staticmethod
    async def process_mentions_and_reactivate(
        db: AsyncSession,
        chat_id,
        user_message: str,
        user_message_emb: list[float]
    ) -> list[ContextNode]:
        # 1. Retrieve all nodes (active and archived) for matching
        nodes_query = await db.execute(
            select(ContextNode).where(ContextNode.chat_id == chat_id)
        )
        all_nodes = nodes_query.scalars().all()

        matching_nodes = []

        for node in all_nodes:
            node_emb = node.embedding
            if not node_emb:
                node_emb = EmbeddingService.get_embedding(node.label)
                node.embedding = node_emb
                db.add(node)

            similarity = EmbeddingService.cosine_similarity(user_message_emb, node_emb)

            # Direct linguistic match or strong semantic similarity (> 0.6)
            is_direct_match = node.label.lower() in user_message.lower()
            is_semantic_match = similarity >= 0.60

            if is_direct_match or is_semantic_match:
                # Restore activation score and update mention count
                node.activation_score = 1.0
                node.frequency_score += 1.0
                node.last_mentioned = datetime.utcnow()

                if not node.is_active:
                    # Reactivate from deep space back into the active orbit!
                    node.is_active = True

                db.add(node)
                matching_nodes.append(node)

        await db.flush()
        return matching_nodes
