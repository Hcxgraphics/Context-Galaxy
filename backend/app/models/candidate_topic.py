from sqlalchemy import Column, String, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.database.base import Base

class CandidateTopic(Base):
    __tablename__ = "candidate_topics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id"))

    topic = Column(String, nullable=False)

    mention_count = Column(Float, default=0)

    semantic_relevance = Column(Float, default=0)

    depth_score = Column(Float, default=0)