from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class ChatCreate(BaseModel):
    title: str

class ChatResponse(BaseModel):
    id: UUID
    title: str
    created_at: datetime

    class Config:
        from_attributes = True