from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID

from app.database.session import get_db
from app.models.context_node import ContextNode
from app.models.context_edge import ContextEdge
from app.models.candidate_topic import CandidateTopic

router = APIRouter(
    prefix="/context",
    tags=["Context Memory"]
)

class PriorityOverride(BaseModel):
    priority: str

class SummaryOverride(BaseModel):
    summary: str


@router.get("/{chat_id}/graph")
async def get_galaxy_graph(
    chat_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    # 1. Fetch all context nodes for this chat
    nodes_query = await db.execute(
        select(ContextNode).where(ContextNode.chat_id == chat_id)
    )
    nodes = nodes_query.scalars().all()

    node_ids = [node.id for node in nodes]

    # 2. Fetch all edges linking these nodes
    edges = []
    if node_ids:
        edges_query = await db.execute(
            select(ContextEdge).where(
                ContextEdge.source_node_id.in_(node_ids) &
                ContextEdge.target_node_id.in_(node_ids)
            )
        )
        edges = edges_query.scalars().all()

    # 3. Fetch all candidate topics waiting in staging
    candidates_query = await db.execute(
        select(CandidateTopic)
        .where(CandidateTopic.chat_id == chat_id)
        .order_by(CandidateTopic.mention_count.desc())
    )
    candidates = candidates_query.scalars().all()

    # Format nodes for React Flow
    flow_nodes = []
    for node in nodes:
        flow_nodes.append({
            "id": str(node.id),
            "type": "planet" if node.node_type.upper() == "ROOT" else "moon",
            "data": {
                "label": node.label,
                "priority": node.priority,
                "is_active": node.is_active,
                "summary": node.summary or f"User is engaged with {node.label}.",
                "activation_score": node.activation_score,
                "frequency_score": node.frequency_score,
                "depth_level": node.depth_level
            },
            # Frontend will compute responsive coordinates dynamically on canvas
            "position": {"x": 0, "y": 0}
        })

    # Format edges for React Flow
    flow_edges = []
    for edge in edges:
        flow_edges.append({
            "id": f"e-{edge.source_node_id}-{edge.target_node_id}",
            "source": str(edge.source_node_id),
            "target": str(edge.target_node_id),
            "type": "orbit",
            "animated": True,  # Keep primary orbit lines animated
            "data": {
                "relationship_type": edge.relationship_type,
                "weight": edge.weight
            }
        })

    # Format candidates
    staging_buffer = []
    for cand in candidates:
        staging_buffer.append({
            "id": str(cand.id),
            "topic": cand.topic,
            "mention_count": cand.mention_count,
            "semantic_relevance": cand.semantic_relevance,
            "persistence_score": cand.persistence_score
        })

    return {
        "nodes": flow_nodes,
        "edges": flow_edges,
        "candidates": staging_buffer
    }


@router.post("/node/{node_id}/priority")
async def override_node_priority(
    node_id: UUID,
    payload: PriorityOverride,
    db: AsyncSession = Depends(get_db)
):
    node_query = await db.execute(
        select(ContextNode).where(ContextNode.id == node_id)
    )
    node = node_query.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="Context node not found")

    new_prio = payload.priority.lower()
    if new_prio not in ["high", "medium", "low"]:
        raise HTTPException(status_code=400, detail="Invalid priority level")

    node.priority = new_prio
    db.add(node)
    await db.commit()

    return {"message": "Priority updated successfully", "node_id": str(node.id), "priority": node.priority}


@router.post("/node/{node_id}/toggle_active")
async def toggle_node_activation(
    node_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    node_query = await db.execute(
        select(ContextNode).where(ContextNode.id == node_id)
    )
    node = node_query.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="Context node not found")

    node.is_active = not node.is_active
    db.add(node)
    await db.commit()

    status = "active" if node.is_active else "archived"
    return {"message": f"Node successfully {status}", "node_id": str(node.id), "is_active": node.is_active}


class RenameOverride(BaseModel):
    label: str

@router.post("/node/{node_id}/summary")
async def override_node_summary(
    node_id: UUID,
    payload: SummaryOverride,
    db: AsyncSession = Depends(get_db)
):
    node_query = await db.execute(
        select(ContextNode).where(ContextNode.id == node_id)
    )
    node = node_query.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="Context node not found")

    node.summary = payload.summary
    db.add(node)
    await db.commit()

    return {"message": "Summary updated successfully", "node_id": str(node.id), "summary": node.summary}

@router.post("/node/{node_id}/rename")
async def rename_node(
    node_id: UUID,
    payload: RenameOverride,
    db: AsyncSession = Depends(get_db)
):
    node_query = await db.execute(
        select(ContextNode).where(ContextNode.id == node_id)
    )
    node = node_query.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="Context node not found")
        
    node.label = payload.label
    db.add(node)
    await db.commit()
    return {"message": "Node renamed successfully", "node_id": str(node.id), "label": node.label}

@router.delete("/node/{node_id}")
async def delete_node(
    node_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import update, delete
    
    # 1. Fetch target node
    node_query = await db.execute(
        select(ContextNode).where(ContextNode.id == node_id)
    )
    node = node_query.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="Context node not found")
        
    # 2. Drop all edges referencing this node
    await db.execute(
        delete(ContextEdge).where(
            (ContextEdge.source_node_id == node_id) |
            (ContextEdge.target_node_id == node_id)
        )
    )
    
    # 3. Detach child moons safely (set their parent to NULL)
    await db.execute(
        update(ContextNode).where(ContextNode.parent_id == node_id).values(parent_id=None)
    )
    
    # 4. Remove node
    await db.delete(node)
    await db.commit()
    return {"message": "Node deleted successfully", "node_id": str(node_id)}
