from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./sentimentiq.db"
    FRONTEND_URL: str = "http://localhost:5173"
    SENTIMENT_MODEL: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"
    EMOTION_MODEL: str = "j-hartmann/emotion-english-distilroberta-base"
    MAX_TEXT_LENGTH: int = 512
    MAX_BATCH_SIZE: int = 500

    class Config:
        env_file = ".env"

settings = Settings()
