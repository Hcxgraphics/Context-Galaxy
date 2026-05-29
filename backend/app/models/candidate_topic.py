from sqlalchemy import Column, String, Float, ForeignKey, JSON, DateTime
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from app.database.base import Base

class CandidateTopic(Base):
    __tablename__ = "candidate_topics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id"))

    topic = Column(String, nullable=False)

    mention_count = Column(Float, default=0)

    semantic_relevance = Column(Float, default=0)

    depth_score = Column(Float, default=0)

    persistence_score = Column(Float, default=0.0)

    embedding = Column(JSON, nullable=True)

    last_mentioned = Column(DateTime, default=datetime.utcnow)