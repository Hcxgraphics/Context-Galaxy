import asyncio
import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.db import engine
from app.database.base import Base
# Import all models to ensure they are registered with Base metadata
from app.models.chat import Chat
from app.models.message import Message
from app.models.context_node import ContextNode
from app.models.candidate_topic import CandidateTopic
from app.models.context_edge import ContextEdge

from sqlalchemy import text

async def reset_db():
    print("Connecting to database and dropping all tables...")
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS context_edges, candidate_topics, messages, context_nodes, chats CASCADE;"))
    print("Re-creating all tables with updated schemas...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database reset successfully!")

if __name__ == "__main__":
    asyncio.run(reset_db())
