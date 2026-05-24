from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db

from app.schemas.chat_schema import (
    ChatCreate,
    ChatResponse
)

from app.services.chat_service import (
    create_chat,
    get_all_chats
)

router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)

@router.post(
    "/create",
    response_model=ChatResponse
)
async def create_chat_route(
    chat: ChatCreate,
    db: AsyncSession = Depends(get_db) #FastAPI automatically injects database session
):
    return await create_chat(
        db,
        chat.title
    )


@router.get(
    "/all",
    response_model=list[ChatResponse]
)
async def get_chats_route(
    db: AsyncSession = Depends(get_db)
):
    return await get_all_chats(db)