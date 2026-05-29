from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.database.init_db import init_db
from app.api.chat import router as chat_router, node_router
from app.api.nlp import router as nlp_router
from app.api.context import router as context_router

@asynccontextmanager
async def lifespan(app: FastAPI):   #FastAPI lifecycle hook. That runs: BEFORE server starts & AFTER server shuts down
    await init_db()
    yield

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(lifespan=lifespan)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(node_router)
app.include_router(nlp_router)
app.include_router(context_router)

@app.get("/")
async def root():
    return {
        "message": "Context Galaxy Backend Running"
    }