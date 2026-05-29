import json
import asyncio
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, update

from app.database.session import get_db
from app.models.message import Message
from app.models.context_node import ContextNode
from app.models.context_edge import ContextEdge
from app.models.candidate_topic import CandidateTopic
from app.models.chat import Chat
from app.memory.context_manager import ContextManager

from app.schemas.chat_schema import (
    ChatCreate,
    ChatResponse
)

from app.services.chat_service import (
    create_chat,
    get_all_chats,
    persist_messages,
    update_context_graph,
    stream_chat_response
)

router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)

node_router = APIRouter(
    tags=["Context Node"]
)

class ChatMessageRequest(BaseModel):
    message: str

class ContextNodeUpdate(BaseModel):
    label: str | None = None
    priority: str | None = None
    summary: str | None = None
    is_active: bool | None = None

class CustomNodeCreate(BaseModel):
    label: str
    summary: str
    priority: str = "medium"

@router.post(
    "/create",
    response_model=dict
)
async def create_chat_route(
    chat: ChatCreate,
    db: AsyncSession = Depends(get_db)
):
    return await create_chat(
        db,
        chat.title,
        chat.first_message
    )

@router.get(
    "/all",
    response_model=list[ChatResponse]
)
async def get_chats_route(
    db: AsyncSession = Depends(get_db)
):
    return await get_all_chats(db)

@router.post("/{chat_id}/stream")
async def stream_chat_route(
    chat_id: str,
    payload: ChatMessageRequest,
    db: AsyncSession = Depends(get_db)
):
    async def token_generator():
        full_content = ""
        try:
            async for token in stream_chat_response(db, chat_id, payload.message):
                full_content += token
                yield f"data: {json.dumps({'content': token})}\n\n"
            
            # Streaming completed successfully, persist user and assistant messages
            await persist_messages(db, chat_id, payload.message, full_content)
            # Evolve graph in the background
            await update_context_graph(db, chat_id, payload.message, full_content)
        except Exception as e:
            print(f"Error in token generator: {e}")
            raise

    return StreamingResponse(
        token_generator(),
        media_type="text/event-stream"
    )

@router.get("/{chat_id}/messages")
async def get_chat_messages(
    chat_id: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        chat_uuid = UUID(chat_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid chat ID format")
        
    result = await db.execute(
        select(Message).where(Message.chat_id == chat_uuid).order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        {
            "id": str(msg.id),
            "role": msg.role,
            "content": msg.content,
            "created_at": msg.created_at.isoformat() if msg.created_at else None
        }
        for msg in messages
    ]

@router.post("/{chat_id}/node")
async def add_custom_node(
    chat_id: str,
    payload: CustomNodeCreate,
    db: AsyncSession = Depends(get_db)
):
    try:
        chat_uuid = UUID(chat_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid chat ID format")
        
    # Check if chat exists
    chat = await db.get(Chat, chat_uuid)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    # Generate local embedding for moon node
    from app.utils.embeddings import EmbeddingService
    node_emb = EmbeddingService.get_embedding(payload.summary)
    
    # Create the custom ContextNode as a moon
    node = ContextNode(
        chat_id=chat_uuid,
        label=payload.label,
        node_type="MOON",
        priority=payload.priority.lower(),
        created_by="user",
        frequency_score=1.0,
        semantic_score=1.0,
        depth_score=1.0,
        activation_score=1.0,
        is_active=True,
        summary=payload.summary,
        embedding=node_emb,
        depth_level=1.0,
        parent_id=chat.root_context_id
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    
    return {
        "id": str(node.id),
        "label": node.label,
        "priority": node.priority.upper(),
        "summary": node.summary,
        "is_active": node.is_active
    }

@router.patch("/context-node/{id}")
@node_router.patch("/context-node/{id}")
async def patch_context_node(
    id: str,
    payload: ContextNodeUpdate,
    db: AsyncSession = Depends(get_db)
):
    try:
        node_uuid = UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid node ID format")
        
    node = await db.get(ContextNode, node_uuid)
    if not node:
        raise HTTPException(status_code=404, detail="Context node not found")
        
    if payload.label is not None:
        node.label = payload.label
    if payload.priority is not None:
        prio = payload.priority.lower()
        if prio not in ["high", "medium", "low"]:
            raise HTTPException(status_code=400, detail="Invalid priority level")
        node.priority = prio
    if payload.summary is not None:
        node.summary = payload.summary
    if payload.is_active is not None:
        node.is_active = payload.is_active
        
    db.add(node)
    await db.commit()
    await db.refresh(node)
    
    return {
        "id": str(node.id),
        "label": node.label,
        "priority": node.priority.upper(),
        "summary": node.summary,
        "is_active": node.is_active
    }

@router.delete("/context-node/{id}")
@node_router.delete("/context-node/{id}")
async def delete_context_node(
    id: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        node_uuid = UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid node ID format")
        
    node = await db.get(ContextNode, node_uuid)
    if not node:
        raise HTTPException(status_code=404, detail="Context node not found")
        
    # Delete edges associated with this node
    await db.execute(
        delete(ContextEdge).where(
            (ContextEdge.source_node_id == node_uuid) |
            (ContextEdge.target_node_id == node_uuid)
        )
    )
    
    # Detach children moons safely (set their parent to NULL)
    await db.execute(
        update(ContextNode).where(ContextNode.parent_id == node_uuid).values(parent_id=None)
    )
    
    # Detach from root context in chat if applicable
    await db.execute(
        update(Chat).where(Chat.root_context_id == node_uuid).values(root_context_id=None)
    )
    
    await db.delete(node)
    await db.commit()
    
    return {"message": "Node deleted successfully", "node_id": str(id)}

@router.patch("/{chat_id}/rename")
async def rename_chat(
    chat_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    try:
        chat_uuid = UUID(chat_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid chat ID format")
        
    chat = await db.get(Chat, chat_uuid)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    if "title" not in payload or not payload["title"].strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")
        
    chat.title = payload["title"].strip()
    db.add(chat)
    await db.commit()
    return {"id": chat_id, "title": chat.title}

@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        chat_uuid = UUID(chat_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid chat ID format")
        
    # Cascade delete messages, nodes, candidates, edges
    await db.execute(delete(Message).where(Message.chat_id == chat_uuid))
    await db.execute(delete(CandidateTopic).where(CandidateTopic.chat_id == chat_uuid))
    
    # Detach edges first by finding all nodes of this chat
    nodes_query = await db.execute(
        select(ContextNode).where(ContextNode.chat_id == chat_uuid)
    )
    nodes = nodes_query.scalars().all()
    node_ids = [n.id for n in nodes]
    if node_ids:
        await db.execute(
            delete(ContextEdge).where(
                ContextEdge.source_node_id.in_(node_ids) |
                ContextEdge.target_node_id.in_(node_ids)
            )
        )
        
    await db.execute(delete(ContextNode).where(ContextNode.chat_id == chat_uuid))
    await db.execute(delete(Chat).where(Chat.id == chat_uuid))
    await db.commit()
    
    return {"message": "Chat deleted successfully", "chat_id": chat_id}
