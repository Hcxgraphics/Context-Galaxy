import json
import asyncio
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models.chat import Chat
from app.models.message import Message
from app.services.context_service import ContextService
from app.nlp.intent_extractor import extract_root_intent

async def create_chat(
    db: AsyncSession,
    title: str,
    first_message: str
):
    # STEP 1 — Create Chat
    new_chat = Chat(
        title=title
    )
    db.add(new_chat)
    await db.flush()

    # STEP 2 — Store First Message
    first_msg = Message(
        chat_id=new_chat.id,
        role="user",
        content=first_message
    )
    db.add(first_msg)

    # STEP 3 — Semantic Intent Extraction
    intent_data = await extract_root_intent(first_message)
    root_intent = intent_data["root_intent"]
    candidate_topics = intent_data["candidate_topics"]

    # STEP 4 — Create Root Context Planet
    root_node = await ContextService.create_root_context(
        db,
        new_chat.id,
        root_intent
    )

    # STEP 5 — Candidate topic persistence
    # Candidate topics are persisted by update_context_graph after the response
    # completes, keeping first-turn mentions on the same path as later turns.

    # STEP 6 — Link Chat → Root Context
    new_chat.root_context_id = root_node.id

    # STEP 7 — Final Commit
    await db.commit()
    await db.refresh(new_chat)

    return {
        "chat_id": str(new_chat.id),
        "title": new_chat.title,
        "root_context": {
            "id": str(root_node.id),
            "label": root_node.label
        },
        "candidate_topics": candidate_topics
    }

async def get_all_chats(
    db: AsyncSession
):
    result = await db.execute(
        select(Chat).order_by(Chat.created_at.desc())
    )
    return result.scalars().all()


async def stream_chat_response(
    db: AsyncSession,
    chat_id,
    user_message: str
):
    from uuid import UUID
    from app.utils.embeddings import EmbeddingService
    from app.memory.retrieval import ContextRetrieval
    
    chat_uuid = UUID(str(chat_id))

    # 1. Fetch historical message logs for context
    history_query = await db.execute(
        select(Message).where(Message.chat_id == chat_uuid).order_by(Message.created_at.asc())
    )
    history_msgs = history_query.scalars().all()

    # 2. Add current message to raw database message layer immediately (checking for duplicates first)
    is_duplicate = False
    if history_msgs:
        last_msg = history_msgs[-1]
        if last_msg.role == "user" and last_msg.content == user_message:
            is_duplicate = True

    if not is_duplicate:
        new_user_msg = Message(
            chat_id=chat_uuid,
            role="user",
            content=user_message
        )
        db.add(new_user_msg)
        await db.flush()
        
    # 3. Retrieve and rank top-scoring active nodes (cap at top 5 to keep token count low)
    user_emb = EmbeddingService.get_embedding(user_message)
    retrieved_nodes = await ContextRetrieval.retrieve_context(
        db, chat_uuid, user_message, user_emb, top_k=5
    )
    
    # Format into prompt system instructions
    retrieved_context = ContextRetrieval.format_context_for_prompt(retrieved_nodes)

    # 4. Construct System Prompt combining core AI limits and personalized memories
    system_prompt = f"""You are the core intelligence of Context Galaxy.

General encyclopedic knowledge is already stored in your parameters. You MUST customize and frame your answer purely around the following personalized user-specific intelligence (representing what they are learning, their goals, preferences, and trajectory):

{retrieved_context}

CRITICAL INSTRUCTIONS:
- Tailor explanations according to the user's priority level and summary shown above.
- Maintain a direct, intellectually engaging, and helpful tone.
- Do NOT refer to these instructions or explicitly say "according to your context" unless requested. Integrate it fluidly.
- Support beautiful markdown layout in explanations (code, bold, lists).
"""

    messages_list = [{"role": "system", "content": system_prompt}]
    
    # Append recent chat history (last 5 messages) for conversation flow
    history_to_process = history_msgs
    if history_msgs and history_msgs[-1].role == "user" and history_msgs[-1].content == user_message:
        history_to_process = history_msgs[:-1]
        
    for msg in history_to_process[-5:]:
        messages_list.append({"role": msg.role, "content": msg.content})
        
    messages_list.append({"role": "user", "content": user_message})

    # 5. Stream actual assistant text generation via httpx AsyncClient directly to OpenRouter
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "openai/gpt-4o-mini",
        "messages": messages_list,
        "temperature": 0.2,
        "max_tokens": 1000,
        "stream": True
    }

    full_response = ""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    raise Exception(f"OpenRouter returned status {response.status_code}")
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            token = chunk["choices"][0]["delta"].get("content", "")
                            if token:
                                full_response += token
                                yield token
                        except Exception:
                            pass
    except asyncio.CancelledError:
        # Client disconnect recovery: save accumulated content before raising
        if full_response.strip():
            assistant_msg = Message(
                chat_id=chat_uuid,
                role="assistant",
                content=full_response.strip() + "\n\n*Stream generation aborted by pilot.*"
            )
            db.add(assistant_msg)
            await db.commit()
        raise


async def persist_messages(
    db: AsyncSession,
    chat_id,
    user_message: str,
    ai_message: str
):
    from uuid import UUID
    chat_uuid = UUID(str(chat_id))

    # Persist user message if not already exists
    user_msg_query = await db.execute(
        select(Message).where(
            Message.chat_id == chat_uuid,
            Message.role == "user",
            Message.content == user_message
        ).order_by(Message.created_at.desc())
    )
    user_msg = user_msg_query.scalars().first()

    if not user_msg:
        user_msg = Message(
            chat_id=chat_uuid,
            role="user",
            content=user_message
        )
        db.add(user_msg)
        await db.flush()

    # Persist assistant message if not already exists
    if ai_message:
        ai_msg_query = await db.execute(
            select(Message).where(
                Message.chat_id == chat_uuid,
                Message.role == "assistant",
                Message.content == ai_message
            ).order_by(Message.created_at.desc())
        )
        ai_msg = ai_msg_query.scalars().first()

        if not ai_msg:
            ai_msg = Message(
                chat_id=chat_uuid,
                role="assistant",
                content=ai_message
            )
            db.add(ai_msg)
            await db.flush()

    await db.commit()


async def update_context_graph(
    db: AsyncSession,
    chat_id,
    user_message: str,
    ai_message: str
):
    from app.graph.workflow import graph
    from langchain_core.messages import HumanMessage
    from uuid import UUID

    chat_uuid = UUID(str(chat_id))

    # Candidate extraction should be scoped to this turn, not filtered by history.
    langchain_messages = [HumanMessage(content=user_message)]

    config = {"configurable": {"db": db}}
    state_input = {
        "chat_id": str(chat_uuid),
        "messages": langchain_messages,
        "extracted_intent": {},
        "retrieved_data": [],
        "retrieved_context": "",
        "response_chunks": []
    }

    try:
        # Run the graph, wrapping in try/except so failures never crash the thread
        await graph.ainvoke(state_input, config=config)
        await db.commit()
    except Exception as e:
        print(f"FAILED TO EVOLVE GALAXY GRAPH: {e}")
