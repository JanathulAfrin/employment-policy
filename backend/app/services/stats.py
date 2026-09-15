import json
import os
from typing import Dict
from app.services.storage import load_documents

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
STATS_FILE = os.path.join(DATA_DIR, "stats.json")

def _ensure_stats_file():
    """Ensure data directory and stats.json file exist."""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(STATS_FILE):
        with open(STATS_FILE, "w", encoding="utf-8") as f:
            json.dump({"questions_asked": 0}, f)

def get_questions_asked_count() -> int:
    """Returns total questions asked counter."""
    _ensure_stats_file()
    try:
        with open(STATS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("questions_asked", 0)
    except Exception:
        return 0

def increment_questions_asked():
    """Increments questions asked counter in persistent JSON storage."""
    _ensure_stats_file()
    current = get_questions_asked_count()
    try:
        with open(STATS_FILE, "w", encoding="utf-8") as f:
            json.dump({"questions_asked": current + 1}, f, indent=2)
    except Exception as e:
        pass

def get_real_system_stats() -> Dict[str, int]:
    """
    Computes live, real backend metrics from actual document storage.
    Zero fake statistics.
    """
    docs = load_documents()
    
    policies_uploaded = len(docs)
    policies_processed = sum(1 for d in docs if d.get("status") == "processed")
    summaries_generated = sum(1 for d in docs if d.get("summary") is not None)
    questions_asked = get_questions_asked_count()

    return {
        "policies_uploaded": policies_uploaded,
        "policies_processed": policies_processed,
        "summaries_generated": summaries_generated,
        "questions_asked": questions_asked
    }
