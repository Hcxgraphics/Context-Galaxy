from sqlalchemy import Column, String, DateTime , ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.database.base import Base

class Chat(Base):
    __tablename__ = "chats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    title = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    messages = relationship("Message", back_populates="chat")

    root_context_id = Column(UUID(as_uuid=True), ForeignKey("context_nodes.id", use_alter=True, name="fk_chat_root_context"), nullable=True)

    context_nodes = relationship("ContextNode", back_populates="chat", foreign_keys="[ContextNode.chat_id]")

    root_context = relationship("ContextNode", foreign_keys=[root_context_id])