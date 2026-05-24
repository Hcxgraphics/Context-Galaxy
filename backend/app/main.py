from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.database.init_db import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):   #FastAPI lifecycle hook. That runs: BEFORE server starts & AFTER server shuts down
    await init_db()
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/")
async def root():
    return {
        "message": "Context Galaxy Backend Running"
    }