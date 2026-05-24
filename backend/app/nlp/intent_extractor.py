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
2. Generate a CLEAN ROOT CONTEXT.
3. Extract SEMANTIC candidate topics.

RULES:

- Root intent must be concise and meaningful.
- Do NOT extract pronouns like "me", "I", "you".
- Do NOT extract generic words like "basics", "stuff", "things", "topics", "concepts" etc.
- Root intent should represent the user's actual learning or the task objective.
- Candidate topics should be semantic concepts.

Return STRICT JSON format:

{{
    "root_intent": "...",
    "candidate_topics": ["...", "..."]
}}
"""
    ),
    (
        "human",
        "{message}"
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