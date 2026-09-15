import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.storage import save_document

client = TestClient(app)

def test_get_stats():
    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert "policies_uploaded" in data
    assert "policies_processed" in data
    assert "summaries_generated" in data
    assert "questions_asked" in data


def test_delete_document_success():
    # Save dummy doc to delete
    doc_id = "doc_delete_test_777"
    save_document({
        "id": doc_id,
        "filename": "temporary_policy.pdf",
        "file_type": "pdf",
        "file_size": 1000,
        "upload_timestamp": "2026-09-15T10:00:00Z",
        "chunks": []
    })

    # Delete
    response = client.delete(f"/api/documents/{doc_id}")
    assert response.status_code == 200
    assert "deleted successfully" in response.json()["message"].lower()

    # Verify deletion 404
    get_res = client.get(f"/api/documents/{doc_id}")
    assert get_res.status_code == 404


def test_delete_nonexistent_document():
    response = client.delete("/api/documents/non_existent_delete_999")
    assert response.status_code == 404
