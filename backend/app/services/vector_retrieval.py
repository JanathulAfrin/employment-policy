import re
import math
from typing import List, Dict

def tokenize(text: str) -> List[str]:
    """Tokenize and normalize text into lowercase alphanumeric words."""
    return re.findall(r'\b[a-z0-9]+\b', text.lower())

def compute_tf(tokens: List[str]) -> Dict[str, float]:
    """Compute term frequencies for a list of tokens."""
    tf = {}
    total = len(tokens)
    if total == 0:
        return tf
    for token in tokens:
        tf[token] = tf.get(token, 0) + 1
    for token in tf:
        tf[token] = tf[token] / total
    return tf

def compute_cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
    """Computes cosine similarity between two term frequency vectors."""
    intersection = set(vec1.keys()) & set(vec2.keys())
    dot_product = sum(vec1[token] * vec2[token] for token in intersection)
    
    norm1 = math.sqrt(sum(val ** 2 for val in vec1.values()))
    norm2 = math.sqrt(sum(val ** 2 for val in vec2.values()))
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
        
    return dot_product / (norm1 * norm2)

def search_document_chunks(document_id: str, question: str, doc_record: Dict, top_k: int = 4, min_score: float = 0.05) -> List[Dict]:
    """
    Searches ONLY chunks belonging to the specified document_id using semantic TF-IDF term matching.
    Ensures strict isolation (never returns chunks from other documents).
    Returns top-K relevant chunks above min_score threshold with similarity scores.
    """
    if not doc_record or doc_record.get("id") != document_id:
        return []

    chunks = doc_record.get("chunks", [])
    if not chunks:
        return []

    question_tokens = tokenize(question)
    if not question_tokens:
        return []

    question_tf = compute_tf(question_tokens)

    scored_chunks = []
    for chunk in chunks:
        chunk_text = chunk.get("text", "")
        chunk_tokens = tokenize(chunk_text)
        chunk_tf = compute_tf(chunk_tokens)
        
        # Calculate TF-IDF / cosine similarity score
        similarity = compute_cosine_similarity(question_tf, chunk_tf)
        
        # Boost score if key question words match exact sub-phrases
        for q_word in question_tokens:
            if len(q_word) > 3 and q_word in chunk_text.lower():
                similarity += 0.05

        if similarity >= min_score:
            scored_chunks.append({
                "chunk_id": chunk.get("chunk_id"),
                "document_id": document_id,
                "text": chunk_text,
                "page_number": chunk.get("page_number"),
                "section_heading": chunk.get("section_heading", "General"),
                "score": round(similarity, 4)
            })

    # Sort chunks by similarity score descending
    scored_chunks.sort(key=lambda x: x["score"], reverse=True)
    return scored_chunks[:top_k]
