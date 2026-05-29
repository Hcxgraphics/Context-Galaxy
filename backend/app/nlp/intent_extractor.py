import spacy
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.core.llm import llm

nlp = spacy.load("en_core_web_sm")

parser = JsonOutputParser()

prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        """
You are an AI intent extraction engine.

Your task:
1. Identify the PRIMARY USER INTENT (1 to 3 keywords only) from the message.
2. Extract candidate topics strictly from the current message in isolation. Focus on named entities, concrete subjects, tools, frameworks, and technical concepts.

RULES:
- Root intent must represent the user's actual learning or the task objective.
- Extract what is ACTUALLY mentioned, not what is implied.
- Do not filter candidate topics through the root intent or prior conversation context.
- Include specific tool names such as CrewAI, LangGraph, AutoGen, LangChain, LlamaIndex, and concrete concepts such as RAG, embeddings, vector databases, memory systems, orchestration, and tool use.
- Minimum 2 characters, maximum 40 characters per topic.
- Return 2-5 candidate topics maximum.
- Do NOT extract pronouns or generic words like "basics", "stuff", "things", "topics".

Return STRICT JSON format:
{{
    "root_intent": "...",
    "candidate_topics": ["...", "..."]
}}
"""
    ),
    (
        "human",
        "Message: {message}"
    )
])

chain = prompt | llm | parser


async def extract_root_intent(
    user_message: str
):
     # -------- NLP PREPROCESSING --------

    doc = nlp(user_message)

    noun_phrases = [
        chunk.text
        for chunk in doc.noun_chunks
    ]

    entities = [
        ent.text
        for ent in doc.ents
    ]

    # -------- LLM SEMANTIC EXTRACTION --------

    result = await chain.ainvoke({
        "message": user_message,
        "noun_phrases": noun_phrases,
        "entities": entities
    })

    return result
