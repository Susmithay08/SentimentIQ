import asyncio
import json
from collections import Counter
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from app.core.database import get_db, Dataset, Entry
from app.services.ml import (
    analyze_sentiment_batch, analyze_emotion_batch,
    cluster_topics, extract_topic_keywords, build_trend_data, analyze_single
)
from app.services.parser import parse_csv

router = APIRouter()


# ── Background analysis task ─────────────────────────────────────────────────
async def _run_analysis(dataset_id: str, texts: list[str], timestamps: list):
    from app.core.database import AsyncSessionLocal
    BATCH = 32

    async with AsyncSessionLocal() as db:
        dataset = await db.get(Dataset, dataset_id)
        if not dataset:
            return
        dataset.status = "analyzing"
        await db.commit()

    try:
        loop = asyncio.get_event_loop()

        # Sentiment in batches
        all_sentiment = []
        for i in range(0, len(texts), BATCH):
            batch = texts[i:i+BATCH]
            results = await loop.run_in_executor(None, analyze_sentiment_batch, batch)
            all_sentiment.extend(results)

        # Emotion in batches
        all_emotion = []
        for i in range(0, len(texts), BATCH):
            batch = texts[i:i+BATCH]
            results = await loop.run_in_executor(None, analyze_emotion_batch, batch)
            all_emotion.extend(results)

        # Topic clustering
        topic_labels = await loop.run_in_executor(None, cluster_topics, texts)
        topic_info = await loop.run_in_executor(None, extract_topic_keywords, texts, topic_labels)

        # Save entries
        entries_data = []
        async with AsyncSessionLocal() as db:
            for i, (text, ts) in enumerate(zip(texts, timestamps)):
                s = all_sentiment[i]
                e = all_emotion[i]
                entry = Entry(
                    dataset_id=dataset_id,
                    text=text,
                    row_index=i,
                    timestamp=ts,
                    sentiment=s['sentiment'],
                    sentiment_score=s['sentiment_score'],
                    pos_score=s['pos_score'],
                    neg_score=s['neg_score'],
                    neu_score=s['neu_score'],
                    emotion=e['emotion'],
                    emotion_scores=e['emotion_scores'],
                    topic_id=int(topic_labels[i]) if i < len(topic_labels) else 0,
                )
                db.add(entry)
                entries_data.append({
                    'sentiment': s['sentiment'],
                    'emotion': e['emotion'],
                    'timestamp': ts,
                    'sentiment_score': s['sentiment_score'],
                })
            await db.commit()

        # Build aggregates
        sentiment_counts = dict(Counter(e['sentiment'] for e in entries_data))
        emotion_counts = dict(Counter(e['emotion'] for e in entries_data))
        avg_conf = sum(e['sentiment_score'] for e in entries_data) / len(entries_data)
        trend = build_trend_data(entries_data)

        async with AsyncSessionLocal() as db:
            dataset = await db.get(Dataset, dataset_id)
            dataset.status = "ready"
            dataset.sentiment_counts = sentiment_counts
            dataset.emotion_counts = emotion_counts
            dataset.avg_confidence = round(avg_conf, 4)
            dataset.topics = topic_info
            dataset.trend_data = trend
            dataset.analyzed_at = datetime.now(timezone.utc)
            await db.commit()

    except Exception as ex:
        async with AsyncSessionLocal() as db:
            dataset = await db.get(Dataset, dataset_id)
            if dataset:
                dataset.status = "error"
                dataset.error_msg = str(ex)
                await db.commit()


# ── Upload CSV ───────────────────────────────────────────────────────────────
@router.post("/datasets/upload")
async def upload_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large. Max 10MB.")

    try:
        texts, timestamps = parse_csv(file_bytes)
    except ValueError as e:
        raise HTTPException(422, str(e))

    if len(texts) > 500:
        texts = texts[:500]
        timestamps = timestamps[:500]

    dataset = Dataset(
        name=name or file.filename or "Untitled Dataset",
        source_type="csv",
        total_rows=len(texts),
        status="pending",
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)

    background_tasks.add_task(_run_analysis, dataset.id, texts, timestamps)

    return _dataset_dict(dataset)


# ── Paste text entries ────────────────────────────────────────────────────────
class TextDatasetRequest(BaseModel):
    name: str = "Text Dataset"
    texts: list[str]


@router.post("/datasets/text")
async def create_text_dataset(
    req: TextDatasetRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    texts = [t.strip() for t in req.texts if t.strip()][:500]
    if not texts:
        raise HTTPException(400, "No text entries provided")

    dataset = Dataset(
        name=req.name,
        source_type="text",
        total_rows=len(texts),
        status="pending",
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)

    background_tasks.add_task(_run_analysis, dataset.id, texts, [None] * len(texts))
    return _dataset_dict(dataset)


# ── Datasets list / detail / delete ─────────────────────────────────────────
def _dataset_dict(d: Dataset) -> dict:
    return {
        "id": d.id, "name": d.name, "source_type": d.source_type,
        "total_rows": d.total_rows, "status": d.status, "error_msg": d.error_msg,
        "sentiment_counts": d.sentiment_counts,
        "emotion_counts": d.emotion_counts,
        "avg_confidence": d.avg_confidence,
        "topics": d.topics,
        "trend_data": d.trend_data,
        "created_at": d.created_at,
        "analyzed_at": d.analyzed_at,
    }


@router.get("/datasets")
async def list_datasets(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Dataset).order_by(desc(Dataset.created_at)))
    return [_dataset_dict(d) for d in res.scalars().all()]


@router.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    d = await db.get(Dataset, dataset_id)
    if not d:
        raise HTTPException(404)
    return _dataset_dict(d)


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    d = await db.get(Dataset, dataset_id)
    if not d:
        raise HTTPException(404)
    res = await db.execute(select(Entry).where(Entry.dataset_id == dataset_id))
    for e in res.scalars().all():
        await db.delete(e)
    await db.delete(d)
    await db.commit()
    return {"deleted": True}


@router.get("/datasets/{dataset_id}/entries")
async def get_entries(
    dataset_id: str,
    limit: int = 50,
    offset: int = 0,
    sentiment: Optional[str] = None,
    emotion: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Entry).where(Entry.dataset_id == dataset_id)
    if sentiment:
        q = q.where(Entry.sentiment == sentiment)
    if emotion:
        q = q.where(Entry.emotion == emotion)
    q = q.order_by(Entry.row_index).limit(limit).offset(offset)
    res = await db.execute(q)
    return [
        {
            "id": e.id, "text": e.text, "row_index": e.row_index,
            "timestamp": e.timestamp, "sentiment": e.sentiment,
            "sentiment_score": e.sentiment_score,
            "pos_score": e.pos_score, "neg_score": e.neg_score, "neu_score": e.neu_score,
            "emotion": e.emotion, "emotion_scores": e.emotion_scores,
            "topic_id": e.topic_id,
        }
        for e in res.scalars().all()
    ]


# ── Live single-text analysis ────────────────────────────────────────────────
class LiveRequest(BaseModel):
    text: str


@router.post("/live")
async def live_analyze(req: LiveRequest):
    if not req.text.strip():
        raise HTTPException(400, "Text required")
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, analyze_single, req.text)
    return result
