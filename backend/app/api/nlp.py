from fastapi import APIRouter

from app.nlp.intent_extractor import extract_root_intent

from app.schemas.nlp_schema import (
    IntentRequest,
    IntentResponse
)

router = APIRouter(
    prefix="/nlp",
    tags=["NLP"]
)

@router.post(
    "/intent",
    response_model=IntentResponse
)
async def test_intent(
    payload: IntentRequest
):
    result = await extract_root_intent(
        payload.message
    )

    return result