from typing import Dict, Any
from langgraph.graph import StateGraph, START, END
from langchain_core.runnables import RunnableConfig

from app.graph.state import GalaxyState
from app.nlp.intent_extractor import extract_root_intent
from app.utils.embeddings import EmbeddingService
from app.memory.topic_tracker import TopicTracker
from app.memory.context_manager import ContextManager
from app.memory.retrieval import ContextRetrieval


async def analyze_intent_node(state: GalaxyState, config: RunnableConfig) -> Dict[str, Any]:
    """Node 1: Extract semantic intent and candidate topics using hybrid spaCy + LLM pipeline."""
    messages = state.get("messages", [])
    if not messages:
        return {"extracted_intent": {"root_intent": "General Chat", "candidate_topics": []}}

    user_message = messages[-1].content
    response_chunks = state.get("response_chunks", [])
    ai_message = response_chunks[0] if response_chunks else ""

    try:
        from app.nlp.intent_extractor import IntentExtractor
        extractor = IntentExtractor()

        # Dual Extraction: User Message + Assistant Response (real topics live here)
        user_result = await extractor.extract(user_message)
        
        assistant_result = None
        if ai_message:
            assistant_result = await extractor.extract(ai_message[:600])

        all_topics = list(user_result.candidate_topics)
        if assistant_result:
            all_topics.extend(assistant_result.candidate_topics)

        # Remove duplicates case-insensitively
        seen = set()
        unique_topics = []
        for t in all_topics:
            key = t.strip().lower()
            if key not in seen:
                seen.add(key)
                unique_topics.append(t)

        root = unique_topics[0] if unique_topics else "General Chat"
        if root == "General Chat" and len(user_message) > 0:
            root = user_message[:30] + "..." if len(user_message) > 30 else user_message

        intent_data = {
            "root_intent": root,
            "candidate_topics": unique_topics
        }
    except Exception as e:
        print(f"Error in analyze_intent_node: {e}")
        intent_data = {"root_intent": "General Chat", "candidate_topics": []}

    return {"extracted_intent": intent_data}


async def update_graph_node(state: GalaxyState, config: RunnableConfig) -> Dict[str, Any]:
    """Node 2: Decay existing active context scores and process query mentions to reactivate nodes."""
    db = config["configurable"].get("db")
    chat_id = state.get("chat_id")
    messages = state.get("messages", [])

    if not db or not chat_id or not messages:
        return {}

    user_message = messages[-1].content
    user_message_emb = EmbeddingService.get_embedding(user_message)

    # 1. Apply memory decay to all currently active nodes
    await ContextManager.decay_memory(db, chat_id)

    # 2. Check all nodes (active + archived) for matches, increment count, and reactivate deep space
    await ContextManager.process_mentions_and_reactivate(db, chat_id, user_message, user_message_emb)

    return {}


async def evaluate_candidates_node(state: GalaxyState, config: RunnableConfig) -> Dict[str, Any]:
    """Node 3: Process extracted topics in candidate buffer and evaluate crystallization thresholds."""
    db = config["configurable"].get("db")
    chat_id = state.get("chat_id")
    intent_data = state.get("extracted_intent", {})
    messages = state.get("messages", [])

    if not db or not chat_id or not intent_data or not messages:
        return {}

    user_message = messages[-1].content
    candidate_topics = intent_data.get("candidate_topics", [])

    # Route candidates to tracking staging buffer, triggering crystallization where applicable
    await TopicTracker.track_candidates(db, chat_id, candidate_topics, user_message)

    return {}


async def rank_and_retrieve_node(state: GalaxyState, config: RunnableConfig) -> Dict[str, Any]:
    """Node 4: Rank active nodes using the scoring equation and retrieve personalized summaries."""
    db = config["configurable"].get("db")
    chat_id = state.get("chat_id")
    messages = state.get("messages", [])

    if not db or not chat_id or not messages:
        return {"retrieved_data": [], "retrieved_context": ""}

    user_message = messages[-1].content
    user_message_emb = EmbeddingService.get_embedding(user_message)

    # Retrieve and rank top-scoring active nodes
    retrieved_nodes = await ContextRetrieval.retrieve_context(
        db, chat_id, user_message, user_message_emb, top_k=4
    )

    # Format into prompt system instructions
    formatted_context = ContextRetrieval.format_context_for_prompt(retrieved_nodes)

    return {
        "retrieved_data": retrieved_nodes,
        "retrieved_context": formatted_context
    }


# Assemble the stateful directed graph
builder = StateGraph(GalaxyState)

builder.add_node("analyze_intent", analyze_intent_node)
builder.add_node("update_graph", update_graph_node)
builder.add_node("evaluate_candidates", evaluate_candidates_node)
builder.add_node("rank_and_retrieve", rank_and_retrieve_node)

builder.add_edge(START, "analyze_intent")
builder.add_edge("analyze_intent", "update_graph")
builder.add_edge("update_graph", "evaluate_candidates")
builder.add_edge("evaluate_candidates", "rank_and_retrieve")
builder.add_edge("rank_and_retrieve", END)

# Compile graph
graph = builder.compile()
