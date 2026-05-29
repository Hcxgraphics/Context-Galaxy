from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.context_node import ContextNode
from app.utils.embeddings import EmbeddingService
from app.memory.context_manager import ContextManager

class ContextRetrieval:

    @staticmethod
    async def retrieve_context(
        db: AsyncSession,
        chat_id,
        query: str,
        query_embedding: list[float],
        top_k: int = 4
    ) -> list[dict]:
        # 1. Fetch only active context nodes
        nodes_query = await db.execute(
            select(ContextNode).where(
                ContextNode.chat_id == chat_id,
                ContextNode.is_active == True
            )
        )
        active_nodes = nodes_query.scalars().all()

        scored_nodes = []
        for node in active_nodes:
            node_emb = node.embedding
            if not node_emb:
                node_emb = EmbeddingService.get_embedding(node.label)
                node.embedding = node_emb
                db.add(node)

            similarity = EmbeddingService.cosine_similarity(query_embedding, node_emb)

            # Calculate total context score using the mathematical formula
            score = ContextManager.calculate_score(node, similarity)
            scored_nodes.append((score, node))

        # Sort descending by score
        scored_nodes.sort(key=lambda x: x[0], reverse=True)

        retrieved_data = []
        for score, node in scored_nodes[:top_k]:
            retrieved_data.append({
                "id": str(node.id),
                "label": node.label,
                "node_type": node.node_type,
                "priority": node.priority,
                "summary": node.summary or f"User is engaged with {node.label}.",
                "score": score,
                "depth_level": node.depth_level
            })

        return retrieved_data

    @staticmethod
    def format_context_for_prompt(retrieved_nodes: list[dict]) -> str:
        if not retrieved_nodes:
            return "No specific personalized context elements retrieved for this query. Offer helpful general assistance."

        context_blocks = []
        context_blocks.append("[Personalized Context Galaxy Core]")
        context_blocks.append("Injecting the following user-specific intelligence (strictly respect these facts, goals, and learning contexts):")

        for node in retrieved_nodes:
            marker = "🪐 Root Planet" if node["node_type"].upper() == "ROOT" else "🌙 Moon"
            context_blocks.append(
                f"- {marker}: {node['label']} (Priority: {node['priority'].upper()}, Relevance Score: {node['score']:.2f})\n"
                f"  Context Summary: {node['summary']}"
            )

        return "\n".join(context_blocks)
