from app.database.db import engine
from app.database.base import Base

from app.models.chat import Chat
from app.models.message import Message
from app.models.context_node import ContextNode
from app.models.candidate_topic import CandidateTopic
from app.models.context_edge import ContextEdge

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)