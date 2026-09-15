import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.storage import save_document
from app.services.vector_retrieval import search_document_chunks

client = TestClient(app)

def setup_test_documents():
    """Seeds two separate documents to test isolation and RAG Q&A."""
    doc_a = {
        "id": "doc_rag_a",
        "filename": "leave_policy_2026.pdf",
        "file_type": "pdf",
        "file_size": 1200,
        "upload_timestamp": "2026-09-15T10:00:00Z",
        "chunks": [
            {
                "chunk_id": "doc_rag_a_chunk_1",
                "document_id": "doc_rag_a",
                "text": "Annual leave entitlement is 20 days per calendar year. Leave requests must be submitted at least 7 days before planned leave.",
                "page_number": 1,
                "section_heading": "Leave Entitlement"
            }
        ]
    }
    
    doc_b = {
        "id": "doc_rag_b",
        "filename": "remote_work_policy.docx",
        "file_type": "docx",
        "file_size": 1500,
        "upload_timestamp": "2026-09-15T10:05:00Z",
        "chunks": [
            {
                "chunk_id": "doc_rag_b_chunk_1",
                "document_id": "doc_rag_b",
                "text": "Remote work is permitted up to 2 days per week. Subject to manager approval.",
                "page_number": None,
                "section_heading": "Remote Work Rules"
            }
        ]
    }

    save_document(doc_a)
    save_document(doc_b)
    return doc_a, doc_b


def test_ask_nonexistent_document():
    response = client.post("/api/documents/non_existent_doc_999/ask", json={"question": "How many days of leave?"})
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_ask_empty_question():
    doc_a, _ = setup_test_documents()
    response = client.post(f"/api/documents/{doc_a['id']}/ask", json={"question": ""})
    assert response.status_code == 422  # Pydantic validation min_length error


def test_ask_valid_question_with_citations():
    doc_a, _ = setup_test_documents()
    response = client.post(
        f"/api/documents/{doc_a['id']}/ask",
        json={"question": "How many days of annual leave do employees get?"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "20 days" in data["answer"].lower() or "leave" in data["answer"].lower()
    assert len(data["sources"]) > 0
    
    source = data["sources"][0]
    assert source["page"] == 1
    assert source["section"] == "Leave Entitlement"
    assert "chunk_id" in source


def test_ask_out_of_scope_insufficient_information():
    doc_a, _ = setup_test_documents()
    response = client.post(
        f"/api/documents/{doc_a['id']}/ask",
        json={"question": "What is the policy for company space shuttle travel?"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "The provided policy does not contain enough information to answer this question."
    assert data["confidence"] == "low"
    assert len(data["sources"]) == 0


def test_document_isolation():
    doc_a, doc_b = setup_test_documents()
    
    # Query doc_a for remote work (which is in doc_b)
    response_a = client.post(
        f"/api/documents/{doc_a['id']}/ask",
        json={"question": "How many days can I work remotely?"}
    )
    assert response_a.status_code == 200
    data_a = response_a.json()
    
    # Verify no chunks from doc_b were returned for doc_a
    for source in data_a.get("sources", []):
        assert source["chunk_id"] != "doc_rag_b_chunk_1"

    # Query doc_b for remote work
    response_b = client.post(
        f"/api/documents/{doc_b['id']}/ask",
        json={"question": "How many days can I work remotely?"}
    )
    assert response_b.status_code == 200
    data_b = response_b.json()
    assert len(data_b["sources"]) > 0
    assert data_b["sources"][0]["section"] == "Remote Work Rules"
