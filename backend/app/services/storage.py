import json
import os
from typing import List, Dict, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
STORAGE_FILE = os.path.join(DATA_DIR, "documents.json")

def _ensure_storage():
    """Ensure data directory and documents.json file exist."""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(STORAGE_FILE):
        with open(STORAGE_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)

def load_documents() -> List[Dict]:
    """Loads all documents from JSON storage."""
    _ensure_storage()
    try:
        with open(STORAGE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_document(doc_data: Dict) -> Dict:
    """Saves a new document or updates existing document in JSON storage."""
    docs = load_documents()
    existing_idx = next((i for i, d in enumerate(docs) if d["id"] == doc_data["id"]), None)
    if existing_idx is not None:
        docs[existing_idx] = doc_data
    else:
        docs.append(doc_data)
        
    _ensure_storage()
    with open(STORAGE_FILE, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)
        
    return doc_data

def get_document_by_id(document_id: str) -> Optional[Dict]:
    """Retrieves a single document by its ID."""
    docs = load_documents()
    for doc in docs:
        if doc["id"] == document_id:
            return doc
    return None

def delete_document(document_id: str) -> bool:
    """Deletes a document by ID from JSON storage. Returns True if deleted, False if not found."""
    docs = load_documents()
    filtered_docs = [d for d in docs if d["id"] != document_id]
    
    if len(filtered_docs) == len(docs):
        return False
        
    _ensure_storage()
    with open(STORAGE_FILE, "w", encoding="utf-8") as f:
        json.dump(filtered_docs, f, indent=2, ensure_ascii=False)
        
    return True
