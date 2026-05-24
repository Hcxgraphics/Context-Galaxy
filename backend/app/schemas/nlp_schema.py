from pydantic import BaseModel

class IntentRequest(BaseModel):
    message: str


class IntentResponse(BaseModel):
    root_intent: str
    candidate_topics: list[str]