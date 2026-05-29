from app.database.db import AsyncSessionLocal
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncSession:  #Dependency injection of FastAPI
    async with AsyncSessionLocal() as session:
        yield session # managed session lifecycle