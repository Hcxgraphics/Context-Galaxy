from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.chat import Chat

async def create_chat(
    db: AsyncSession,
    title: str
):
    new_chat = Chat(title=title)

    db.add(new_chat)

    await db.commit()

    await db.refresh(new_chat)

    return new_chat


async def get_all_chats(
    db: AsyncSession
):
    result = await db.execute(
        select(Chat)
    )

    return result.scalars().all() #Extracts ORM objects from query result