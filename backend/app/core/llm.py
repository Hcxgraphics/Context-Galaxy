from langchain_openai import ChatOpenAI

from app.core.config import settings


llm = ChatOpenAI(
    model="openai/gpt-4.1-mini",
    api_key=settings.OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    temperature=0,
    max_tokens=300  # To avoid Token/billing issue
)