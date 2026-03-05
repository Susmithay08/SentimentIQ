from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, DateTime, Text, Integer, Float, JSON
from datetime import datetime, timezone
import uuid
from app.core.config import settings


class Base(DeclarativeBase):
    pass


class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    source_type = Column(String, default="csv")     # csv | text | api
    total_rows = Column(Integer, default=0)
    status = Column(String, default="pending")      # pending | analyzing | ready | error
    error_msg = Column(Text, nullable=True)
    # Aggregated stats (stored as JSON for fast dashboard load)
    sentiment_counts = Column(JSON, nullable=True)  # {positive, negative, neutral}
    emotion_counts = Column(JSON, nullable=True)    # {joy, anger, fear, ...}
    avg_confidence = Column(Float, nullable=True)
    topics = Column(JSON, nullable=True)            # [{label, keywords, count}]
    trend_data = Column(JSON, nullable=True)        # [{date, positive, negative, neutral}]
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    analyzed_at = Column(DateTime, nullable=True)


class Entry(Base):
    __tablename__ = "entries"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, nullable=False, index=True)
    text = Column(Text, nullable=False)
    row_index = Column(Integer, nullable=True)
    timestamp = Column(String, nullable=True)       # original timestamp if present
    # Sentiment
    sentiment = Column(String, nullable=True)       # positive | negative | neutral
    sentiment_score = Column(Float, nullable=True)  # confidence 0-1
    pos_score = Column(Float, nullable=True)
    neg_score = Column(Float, nullable=True)
    neu_score = Column(Float, nullable=True)
    # Emotion
    emotion = Column(String, nullable=True)         # dominant emotion
    emotion_scores = Column(JSON, nullable=True)    # all emotion scores
    # Topic
    topic_id = Column(Integer, nullable=True)


engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
