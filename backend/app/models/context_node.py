from sqlalchemy import (
    Column,
    String,
    Float,
    Boolean,
    ForeignKey,
    DateTime
)

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

import uuid
from datetime import datetime

from app.database.base import Base

class ContextNode(Base):
    __tablename__ = "context_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id"))

    parent_id = Column(UUID(as_uuid=True), ForeignKey("context_nodes.id"), nullable=True) #Self-Referencing Relationship

    label = Column(String, nullable=False)

    node_type = Column(String, default="subtopic")

    priority = Column(String, default="medium")

    created_by = Column(String, default="auto")

    frequency_score = Column(Float, default=0)

    semantic_score = Column(Float, default=0)

    depth_score = Column(Float, default=0)

    activation_score = Column(Float, default=0)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    chat = relationship("Chat", back_populates="context_nodes")

    parent = relationship("ContextNode", remote_side=[id])