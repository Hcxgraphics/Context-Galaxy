from typing import TypedDict, List, Dict, Any
from langchain_core.messages import BaseMessage

class GalaxyState(TypedDict):
    chat_id: str
    messages: List[BaseMessage]
    extracted_intent: Dict[str, Any]
    retrieved_data: List[Dict[str, Any]]
    retrieved_context: str
    response_chunks: List[str]
