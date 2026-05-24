from dotenv import load_dotenv
import os

load_dotenv()

class Settings:
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    DATABASE_URL = os.getenv("DATABASE_URL")

settings = Settings()