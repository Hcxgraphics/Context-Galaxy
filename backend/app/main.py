from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.database.init_db import init_db
from app.api.chat import router as chat_router
from app.api.nlp import router as nlp_router

@asynccontextmanager
async def lifespan(app: FastAPI):   #FastAPI lifecycle hook. That runs: BEFORE server starts & AFTER server shuts down
    await init_db()
    yield

app = FastAPI(lifespan=lifespan)
app.include_router(chat_router)
app.include_router(nlp_router)

@app.get("/")
async def root():
    return {
        "message": "Context Galaxy Backend Running"
    }