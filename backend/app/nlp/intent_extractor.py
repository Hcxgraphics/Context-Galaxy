import spacy
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.core.llm import llm

nlp = spacy.load("en_core_web_sm")
parser = JsonOutputParser()

EXTRACTION_PROMPT = """
Extract the key topics from this text. Focus on:
- Named entities: people, roles, places, organizations (e.g. "Prime Minister", "CrewAI", "LangGraph")
- Core concepts being discussed (e.g. "decision making", "leadership", "RAG")
- Specific technical or domain terms

Text: "{text}"

Rules:
- Capture "Prime Minister" even if only mentioned once — proper roles always qualify
- Normalize to title case: "prime minister" → "Prime Minister"
- Do NOT extract: filler words, pronouns, adjectives without nouns
- Return 2-5 topics maximum, ranked by importance

Return ONLY valid JSON, no other text:
{{"candidate_topics": ["Topic One", "Topic Two"]}}
"""

prompt_template = ChatPromptTemplate.from_messages([
    ("system", EXTRACTION_PROMPT)
])

extraction_chain = prompt_template | llm | parser

class ExtractionResult:
    def __init__(self, candidate_topics: list[str]):
        self.candidate_topics = candidate_topics

class IntentExtractor:
    async def extract(self, text: str) -> ExtractionResult:
        try:
            result = await extraction_chain.ainvoke({"text": text})
            topics = result.get("candidate_topics", [])
            # Return properly formatted strings
            return ExtractionResult([str(t).strip() for t in topics if t])
        except Exception as e:
            print(f"Error during intent extraction: {e}")
            return ExtractionResult([])

async def extract_root_intent(user_message: str):
    extractor = IntentExtractor()
    res = await extractor.extract(user_message)
    # Generate a simple root intent from the first topic or message snippet
    root = res.candidate_topics[0] if res.candidate_topics else "General Chat"
    if root == "General Chat" and len(user_message) > 0:
        root = user_message[:30] + "..." if len(user_message) > 30 else user_message
        
    return {
        "root_intent": root,
        "candidate_topics": res.candidate_topics
    }
