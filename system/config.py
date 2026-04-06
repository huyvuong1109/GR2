import os
from dotenv import load_dotenv
load_dotenv()

# Tự động load từ Kaggle Secrets nếu đang chạy trên Kaggle
try:
    from kaggle_secrets import UserSecretsClient
    secrets = UserSecretsClient()
    os.environ["OPENROUTER_API_KEY"] = secrets.get_secret("openrouterapi")
except Exception:
    pass  # Không phải môi trường Kaggle, bỏ qua

class Settings:
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    llm_model: str = os.getenv(
        "LLM_MODEL",
        "google/gemini-2.5-flash-lite-preview-09-2025"
    )

settings = Settings()