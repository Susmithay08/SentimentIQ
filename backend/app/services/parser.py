import csv
import io
from typing import Optional


def parse_csv(file_bytes: bytes) -> tuple[list[str], list[Optional[str]]]:
    """
    Parse CSV and return (texts, timestamps).
    Auto-detects text column and optional timestamp column.
    """
    try:
        content = file_bytes.decode('utf-8', errors='replace')
    except Exception:
        raise ValueError("Could not decode file. Make sure it's UTF-8 encoded.")

    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise ValueError("CSV has no headers.")

    headers = [h.lower().strip() for h in reader.fieldnames]

    # Find text column
    text_candidates = ['text', 'content', 'message', 'comment', 'review', 'body',
                       'description', 'tweet', 'post', 'feedback', 'note']
    text_col = None
    for candidate in text_candidates:
        if candidate in headers:
            text_col = reader.fieldnames[headers.index(candidate)]
            break
    if not text_col:
        # Use the longest string column as fallback
        text_col = reader.fieldnames[0]

    # Find timestamp column
    ts_candidates = ['date', 'timestamp', 'created_at', 'time', 'datetime', 'posted_at', 'at']
    ts_col = None
    for candidate in ts_candidates:
        if candidate in headers:
            ts_col = reader.fieldnames[headers.index(candidate)]
            break

    texts = []
    timestamps = []
    for row in reader:
        text = str(row.get(text_col, '') or '').strip()
        if not text or len(text) < 3:
            continue
        texts.append(text[:512])
        timestamps.append(str(row.get(ts_col, '') or '').strip() if ts_col else None)

    if not texts:
        raise ValueError(f"No text content found in column '{text_col}'.")

    return texts, timestamps
