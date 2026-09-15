from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import os
import json
import urllib.request
import logging

from app.services.storage import get_document_by_id
from app.services.vector_retrieval import search_document_chunks
from app.services.stats import increment_questions_asked

router = APIRouter(prefix="/api/documents", tags=["ask"])
logger = logging.getLogger("ask_router")

INSUFFICIENT_INFO_RESPONSE = "The provided policy does not contain enough information to answer this question."

RAG_SYSTEM_PROMPT = """You are a precise and trustworthy Employment Policy Assistant.

Answer the user's question ONLY using the provided policy evidence.

Do not use external knowledge.
Do not make assumptions.
Do not invent rules.
Do not infer information that is not explicitly supported by the policy.

Preserve the exact meaning and scope of the policy.

Pay special attention to modal terms such as:
must, may, should, normally, will, subject to approval.

If the evidence does not contain enough information to answer the question, respond EXACTLY:

The provided policy does not contain enough information to answer this question.

If policy provisions conflict, identify the conflicting provisions and explain that the policy contains contradictory information. Do not decide which provision is correct.

Do not provide legal advice.
Do not make HR or management decisions.

Always provide supporting policy evidence with page and section information when available."""


class AskQuestionRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500, description="Natural language question about policy")


def call_llm_rag(question: str, retrieved_chunks: list, api_key: str, model_name: str, api_url: str):
    """
    Formulates prompt with retrieved policy chunks + question and sends to LLM API.
    """
    evidence_text = "\n\n".join(
        f"--- EVIDENCE ITEM {idx+1} [Page: {c.get('page_number') or 'N/A'}, Section: {c.get('section_heading') or 'General'}] ---\n{c['text']}"
        for idx, c in enumerate(retrieved_chunks)
    )

    prompt_user = f"QUESTION:\n{question}\n\nPOLICY EVIDENCE:\n{evidence_text}"

    endpoint = api_url or "https://api.openai.com/v1/chat/completions"
    model = model_name or "gpt-3.5-turbo"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": RAG_SYSTEM_PROMPT},
            {"role": "user", "content": prompt_user}
        ],
        "temperature": 0.0
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")

    with urllib.request.urlopen(req, timeout=30) as response:
        res_body = response.read().decode("utf-8")
        res_json = json.loads(res_body)
        return res_json["choices"][0]["message"]["content"].strip()


def generate_grounded_rag_answer(question: str, retrieved_chunks: list):
    """
    Grounded RAG synthesis engine when LLM_API_KEY is unconfigured or fallback is triggered.
    Ensures answers are grounded ONLY in retrieved chunks, returning exact insufficient info message if unsupported.
    """
    if not retrieved_chunks:
        return INSUFFICIENT_INFO_RESPONSE

    # Check if question keywords match retrieved evidence
    q_words = set(re.findall(r'\b[a-z0-9]+\b', question.lower())) - {"what", "how", "when", "where", "who", "why", "the", "a", "an", "is", "are", "do", "does", "can"}
    
    matching_sentences = []
    for c in retrieved_chunks:
        text = c.get("text", "")
        sentences = [s.strip() for s in text.split(".") if s.strip()]
        for sent in sentences:
            s_words = set(re.findall(r'\b[a-z0-9]+\b', sent.lower()))
            overlap = q_words & s_words
            if len(overlap) >= 1:
                matching_sentences.append(sent)

    if matching_sentences:
        # Combine top matching sentences
        unique_sents = list(dict.fromkeys(matching_sentences))[:3]
        return ". ".join(unique_sents) + "."
    
    # If chunks exist but don't explicitly answer question topic
    first_chunk_text = retrieved_chunks[0].get("text", "").strip()
    if any(term in first_chunk_text.lower() for term in q_words):
        return first_chunk_text[:300] + ("..." if len(first_chunk_text) > 300 else "")

    return INSUFFICIENT_INFO_RESPONSE


import re

@router.post("/{document_id}/ask")
async def ask_policy_question(document_id: str, req: AskQuestionRequest):
    """
    Answers natural language question strictly using retrieved policy chunks from the specified document.
    Returns answer, source evidence cards (with page and section metadata), and confidence level.
    """
    question = req.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty."
        )

    # 1. Fetch document from storage
    doc = get_document_by_id(document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found."
        )

    # 2. Retrieve relevant chunks belonging ONLY to this document
    retrieved_chunks = search_document_chunks(document_id, question, doc, top_k=4, min_score=0.04)

    # 3. Handle case where no relevant chunks pass score threshold
    if not retrieved_chunks:
        return {
            "answer": INSUFFICIENT_INFO_RESPONSE,
            "sources": [],
            "confidence": "low"
        }

    # 4. Generate answer via LLM or grounded fallback
    api_key = os.getenv("LLM_API_KEY", "").strip()
    model_name = os.getenv("LLM_MODEL_NAME", "gpt-3.5-turbo").strip()
    api_url = os.getenv("LLM_API_URL", "").strip()

    if api_key and api_key != "your_llm_api_key_here":
        try:
            answer = call_llm_rag(question, retrieved_chunks, api_key, model_name, api_url)
        except Exception as err:
            logger.warning(f"LLM RAG API call failed: {str(err)}. Falling back to grounded RAG engine.")
            answer = generate_grounded_rag_answer(question, retrieved_chunks)
    else:
        answer = generate_grounded_rag_answer(question, retrieved_chunks)

    # Format sources for response
    sources = []
    for c in retrieved_chunks:
        sources.append({
            "chunk_id": c["chunk_id"],
            "text": c["text"],
            "page": c.get("page_number"),
            "section": c.get("section_heading", "General"),
            "score": c.get("score")
        })

    confidence = "high" if retrieved_chunks[0]["score"] > 0.15 else "medium"

    # Increment stats counter
    increment_questions_asked()

    return {
        "answer": answer,
        "sources": sources,
        "confidence": confidence
    }
