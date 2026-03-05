"""
Real ML pipeline:
- Sentiment: cardiffnlp/twitter-roberta-base-sentiment-latest (pos/neg/neu + scores)
- Emotion: j-hartmann/emotion-english-distilroberta-base (joy/anger/fear/sadness/surprise/disgust/neutral)
- Topics: TF-IDF + KMeans clustering
Models are lazy-loaded on first use and cached globally.
"""
import re
import numpy as np
from collections import Counter, defaultdict
from typing import Optional

_sentiment_pipeline = None
_emotion_pipeline = None


def get_sentiment_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        from transformers import pipeline
        _sentiment_pipeline = pipeline(
            "text-classification",
            model="cardiffnlp/twitter-roberta-base-sentiment-latest",
            top_k=None,   # return all scores
            truncation=True,
            max_length=512,
        )
    return _sentiment_pipeline


def get_emotion_pipeline():
    global _emotion_pipeline
    if _emotion_pipeline is None:
        from transformers import pipeline
        _emotion_pipeline = pipeline(
            "text-classification",
            model="j-hartmann/emotion-english-distilroberta-base",
            top_k=None,
            truncation=True,
            max_length=512,
        )
    return _emotion_pipeline


def clean_text(text: str) -> str:
    text = str(text).strip()
    text = re.sub(r'http\S+', '', text)
    text = re.sub(r'@\w+', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:512]


def analyze_sentiment_batch(texts: list[str]) -> list[dict]:
    pipe = get_sentiment_pipeline()
    cleaned = [clean_text(t) for t in texts]
    results = pipe(cleaned, batch_size=16)

    out = []
    for res in results:
        scores = {r['label'].lower(): r['score'] for r in res}
        # Normalize label names
        pos = scores.get('positive', scores.get('pos', 0))
        neg = scores.get('negative', scores.get('neg', 0))
        neu = scores.get('neutral', scores.get('neu', 0))

        dominant = max([('positive', pos), ('negative', neg), ('neutral', neu)], key=lambda x: x[1])
        out.append({
            'sentiment': dominant[0],
            'sentiment_score': dominant[1],
            'pos_score': pos,
            'neg_score': neg,
            'neu_score': neu,
        })
    return out


def analyze_emotion_batch(texts: list[str]) -> list[dict]:
    pipe = get_emotion_pipeline()
    cleaned = [clean_text(t) for t in texts]
    results = pipe(cleaned, batch_size=16)

    out = []
    for res in results:
        scores = {r['label'].lower(): round(r['score'], 4) for r in res}
        dominant = max(scores.items(), key=lambda x: x[1])
        out.append({
            'emotion': dominant[0],
            'emotion_scores': scores,
        })
    return out


def cluster_topics(texts: list[str], n_topics: int = 5) -> list[int]:
    """TF-IDF + KMeans topic clustering. Returns topic_id per text."""
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.cluster import KMeans

        if len(texts) < n_topics:
            return [0] * len(texts)

        cleaned = [clean_text(t) for t in texts]
        vectorizer = TfidfVectorizer(
            max_features=500,
            stop_words='english',
            min_df=2,
            ngram_range=(1, 2),
        )
        X = vectorizer.fit_transform(cleaned)

        actual_topics = min(n_topics, len(texts) // 3, 8)
        km = KMeans(n_clusters=actual_topics, random_state=42, n_init=10)
        labels = km.fit_predict(X)

        return labels.tolist()
    except Exception:
        return [0] * len(texts)


def extract_topic_keywords(texts: list[str], labels: list[int]) -> list[dict]:
    """Get top keywords per topic cluster."""
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer

        topic_map = defaultdict(list)
        for text, label in zip(texts, labels):
            topic_map[label].append(clean_text(text))

        topics = []
        for topic_id in sorted(topic_map.keys()):
            topic_texts = topic_map[topic_id]
            if not topic_texts:
                continue

            vec = TfidfVectorizer(max_features=50, stop_words='english', min_df=1)
            try:
                X = vec.fit_transform(topic_texts)
                scores = X.sum(axis=0).A1
                words = vec.get_feature_names_out()
                top_idx = scores.argsort()[-6:][::-1]
                keywords = [words[i] for i in top_idx]
            except Exception:
                keywords = []

            topics.append({
                'id': int(topic_id),
                'keywords': keywords,
                'label': f"Topic {topic_id + 1}: {', '.join(keywords[:3])}",
                'count': len(topic_texts),
            })
        return topics
    except Exception:
        return [{'id': 0, 'keywords': [], 'label': 'Topic 1', 'count': len(texts)}]


def build_trend_data(entries_data: list[dict]) -> list[dict]:
    """Build trend over time if timestamps exist."""
    dated = [(e.get('timestamp', ''), e.get('sentiment', 'neutral')) for e in entries_data
             if e.get('timestamp')]
    if len(dated) < 3:
        return []

    # Group by date prefix (first 10 chars = YYYY-MM-DD)
    day_map = defaultdict(lambda: Counter())
    for ts, sentiment in dated:
        day = str(ts)[:10]
        day_map[day][sentiment] += 1

    trend = []
    for day in sorted(day_map.keys())[-30:]:  # last 30 days
        counts = day_map[day]
        trend.append({
            'date': day,
            'positive': counts.get('positive', 0),
            'negative': counts.get('negative', 0),
            'neutral': counts.get('neutral', 0),
        })
    return trend


def analyze_single(text: str) -> dict:
    """Quick single-text analysis for live mode."""
    cleaned = clean_text(text)
    if not cleaned:
        return {}

    s_result = analyze_sentiment_batch([cleaned])[0]
    e_result = analyze_emotion_batch([cleaned])[0]
    return {**s_result, **e_result}
