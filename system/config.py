import os
from dotenv import load_dotenv
load_dotenv()

class Settings:
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    llm_model: str = os.getenv(
        "LLM_MODEL",
        "google/gemini-2.5-flash-lite-preview-09-2025"
    )

settings = Settings()