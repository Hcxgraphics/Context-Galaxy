from sqlalchemy import Column, String, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.database.base import Base

class ContextEdge(Base):
    __tablename__ = "context_edges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    source_node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("context_nodes.id")
    )

    target_node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("context_nodes.id")
    )

    relationship_type = Column(String, default="related")

    weight = Column(Float, default=0)