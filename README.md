<div align="center">

<h1>✦ Context Galaxy</h1>

<p><em>A semantic memory workspace where conversations evolve into explorable galaxies</em></p>

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)
![React Flow](https://img.shields.io/badge/React_Flow-FF0072?style=for-the-badge&logo=react&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=python&logoColor=white)
![Pydantic](https://img.shields.io/badge/Pydantic-E92063?style=for-the-badge&logo=pydantic&logoColor=white)
![OpenRouter](https://img.shields.io/badge/OpenRouter-7C3AED?style=for-the-badge&logo=openai&logoColor=white)

<br/>

<p align="center">
  <img src="assets/landing_page.gif" width="900"/>
</p>

> **Context Galaxy is not a chatbot.**
> It's a graph-based AI memory system where topics crystallize into planets, conversations become galaxies, and your AI learns *you* over time.

</div>

---

## What Makes It Different

Most AI tools pass raw chat history into the LLM context window. Context Galaxy builds a **semantic property graph** from your conversations instead only storing what's user-specific and injecting only what's relevant. The LLM already knows general facts; this system only tracks *your* learning path, priorities, and evolving interests.

```
Standard AI             Context Galaxy
──────────────          ──────────────────────────────────
[msg 1]                 Planet: Learning LangChain  (root)
[msg 2]   →  LLM           └── Moon: RAG           (crystallized after 3 mentions)
[msg 3]                    └── Moon: Agents         (forming — 2/3)
[msg N]                    └── Archived: LangChain v0.1  (deep space)
```

---

## Core Features

<p align="center">
  <img src="assets/galaxy_Map.gif" width="900"/>
</p>


### 🪐 Galaxy Visualization
Built on **React Flow** with custom circular planet nodes, roots are large glowing violet spheres, branches are smaller blue moons, and candidates are dim proto-moons. Nodes are laid out by an orbital algorithm: root at cente with candidate nodes & branches at radius.

### 🧠 Graph-Based Semantic Memory
Memory is stored as a **property graph in PostgreSQL** via **SQLAlchemy async ORM**. Each node carries a label, type (`root / branch / candidate`), priority, score, embedding vector, and `is_active` flag. 
Edges store the cosine similarity weight between connected concepts. 
Three isolated layers: 
raw message log → dynamic context graph → visual galaxy.

### 🌱 Topic Crystallization Engine
New topics start as **Candidates** — they don't enter memory until they've been meaningfully discussed by user frequently . The system tracks `mention_count` per candidate. At **3 mentions** (raised to 5 in long chats), the candidate topics crystallizes into a full graph node, gets connected to the root planet with a weighted edge, and disappears from the forming moons list. This prevents graph explosion from casual one-off mentions.

### 🔍 Semantic Deduplication
Before tracking any new candidate, two checks run in sequence:

1. **Fuzzy string match** : normalized comparison + substring containment catches `"RAG"` vs `"RAG pipeline"`, and Levenshtein distance ≤ 2 catches typos like `"retreival"`. If matched, increments the existing candidate instead of forking.

2. **Embedding cosine similarity** — `sentence-transformers` generates a 384-dim vector for the new topic and compares it against all existing candidates. Similarity ≥ 0.82 treats them as the same concept.

### 📡 Dual-Source Intent Extraction
Topics are extracted from **both the user message and the assistant response** (first 600 chars). This matters because casual user questions like *"Prime minister tough job right?"* have low noun density, but the assistant response contains the rich vocabulary (`"Prime Minister"`, `"policy making"`, `"leadership"`). 
Pipeline: **spaCy** for noun phrase chunking and NER → **Groq LLM** for semantic abstraction → structured JSON output.

### 📥 Context Jar Sidebar
Real time sidebar showing the live state of memory. 
**Active Core** tab: Shows crystallized nodes that are actively shaping LLM responses. 
**Deep Space** tab: shows archived older nodes. **Forming Moons**: Shows top5 candidates by mention count with a live progress bar that can turn into a subtopic node with active polling.
Per node controls: Priority (HIGH / MEDIUM / LOW), activate/deactivate, delete.

### 💬 Streaming Chat with Adaptive Length
Chat streams via **FastAPI SSE** with **httpx async streaming** to OpenRouter on the backend. Before each request, `max_tokens` is set based on question type: `120` for yes/no confirmations, up to `1000` for deep dives using regex pattern classification. 
Also includes inline message editing with per message copy button, and a regenerate option.

### 🗂️ Chat Management
Left sidebar with a complete chat history inspired by modern day LLMs. With options for renaming and cascade deletion .

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend framework | **Next.js 14** (TypeScript) | App routing, SSR, file-based pages |
| Graph visualization | **React Flow** | Custom planet nodes, orbital layout, minimap |
| Animations | **Framer Motion** | Sidebar transitions, node entrances |
| Backend API | **FastAPI** | Async REST endpoints + SSE streaming |
| ORM | **SQLAlchemy 2.0 async** | Async database queries with asyncpg |
| Schema validation | **Pydantic v2** | Request/response models, settings |
| Database | **PostgreSQL** | Property graph storage — nodes, edges, candidates |
| LLM orchestration | **LangChain + LangGraph** | Prompt management, stateful workflow |
| LLM gateway | **OpenRouter** | Routes to Claude, GPT-4o, Mixtral, etc. |
| Fast inference | **Groq** | Low-latency intent extraction |
| NLP preprocessing | **spaCy** | Tokenization, NER, noun phrase chunking |
| Embeddings | **sentence-transformers** | `all-MiniLM-L6-v2`, 384-dim vectors |
| Async HTTP | **httpx** | Streaming LLM calls to OpenRouter |
| Styling | **Tailwind CSS** | Deep space dark theme, utility-first |

---

## Project Structure

```
context-galaxy/
├── backend/
│   └── app/
│       ├── api/
│       │   └── chat.py              # REST + SSE endpoints, graph/context routes
│       ├── core/
│       │   ├── config.py            # Pydantic BaseSettings
│       │   └── llm.py               # OpenRouter / Groq client
│       ├── database/
│       │   └── session.py           # Async SQLAlchemy session
│       ├── models/                  # ORM models
│       │   ├── chat.py
│       │   ├── message.py
│       │   ├── context_node.py
│       │   ├── candidate_topic.py
│       │   └── context_edge.py
│       ├── nlp/
│       │   └── intent_extractor.py  # spaCy + Groq hybrid pipeline
│       ├── services/
│       │   └── chat_service.py      # stream_llm, crystallization, deduplication,
│       │                            # context prompt builder, pruning
│       └── main.py
│
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx             # New galaxy home
        │   ├── chat/[id]/page.tsx   # Streaming chat thread
        │   └── galaxy/[id]/page.tsx # Galaxy Map (dynamic import, SSR-safe)
        └── components/
            ├── GalaxyVisualizer.tsx # React Flow — module-level nodeTypes (no infinite loop)
            ├── ContextJarSidebar.tsx
            ├── LeftSidebar.tsx
            └── MessageBubble.tsx    # Copy, edit, regenerate actions
```

---

## Getting Started

### Prerequisites
- Node.js 18+, Python 3.11+, PostgreSQL 15+
- [OpenRouter API key](https://openrouter.ai)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# configure .env then:
python -m app.database.init_db
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

### Environment Variables

```env
# backend/.env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/context_galaxy
OPENROUTER_API_KEY=sk-or-...
LLM_MODEL=anthropic/claude-3-haiku
GROQ_API_KEY=gsk_...
```

---

## Database Schema (simplified)

```
chats          → id, title, created_at
messages       → id, chat_id, role, content, created_at
context_nodes  → id, chat_id, label, node_type, priority, score,
                 embedding[], is_active, mention_count, last_accessed
context_edges  → id, chat_id, source_id, target_id, weight
candidate_topics → id, chat_id, label, mention_count, threshold, last_seen
```

---

## Future Roadmap

| Status | Feature |
|---|---|
| 🔄 | LangGraph stateful multi-node workflow |
| 🔄 | pgvector for native embedding similarity queries |
| 🔄 | Memory decay scoring + auto-archive |
| 📋 | User authentication |
| 📋 | Cross-chat galaxy relationship map |
| 📋 | Export galaxy as JSON / GraphML |

---

<div align="center">
<sub>Built on the belief that AI memory should reflect <em>you</em> — not just your last message.</sub>
<br/><br/>
<b>✦ Context Galaxy</b>
</div>
