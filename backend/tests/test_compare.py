import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.storage import save_document

client = TestClient(app)

def setup_comparison_test_documents():
    """Seeds two policy versions to test version comparison diff logic."""
    doc_old = {
        "id": "doc_ver_2025",
        "filename": "Leave_Policy_2025.pdf",
        "file_type": "pdf",
        "file_size": 1100,
        "upload_timestamp": "2025-01-01T10:00:00Z",
        "chunks": [
            {
                "chunk_id": "doc_ver_2025_c1",
                "document_id": "doc_ver_2025",
                "text": "Annual leave notice period is 14 days in advance.",
                "page_number": 3,
                "section_heading": "Leave Notice Period"
            },
            {
                "chunk_id": "doc_ver_2025_c2",
                "document_id": "doc_ver_2025",
                "text": "Travel reimbursement limit is $500 per trip.",
                "page_number": 4,
                "section_heading": "Travel Expense"
            }
        ]
    }

    doc_new = {
        "id": "doc_ver_2026",
        "filename": "Leave_Policy_2026.pdf",
        "file_type": "pdf",
        "file_size": 1300,
        "upload_timestamp": "2026-01-01T10:00:00Z",
        "chunks": [
            {
                "chunk_id": "doc_ver_2026_c1",
                "document_id": "doc_ver_2026",
                "text": "Annual leave notice period is 7 days in advance.",
                "page_number": 3,
                "section_heading": "Leave Notice Period"
            },
            {
                "chunk_id": "doc_ver_2026_c2",
                "document_id": "doc_ver_2026",
                "text": "Remote work is permitted up to 2 days per week.",
                "page_number": 5,
                "section_heading": "Remote Work Allowance"
            }
        ]
    }

    save_document(doc_old)
    save_document(doc_new)
    return doc_old, doc_new


def test_compare_same_document_error():
    doc_old, _ = setup_comparison_test_documents()
    response = client.post(
        "/api/documents/compare",
        json={"old_document_id": doc_old["id"], "new_document_id": doc_old["id"]}
    )
    assert response.status_code == 400
    assert "must be different" in response.json()["detail"].lower()


def test_compare_nonexistent_document():
    doc_old, _ = setup_comparison_test_documents()
    response = client.post(
        "/api/documents/compare",
        json={"old_document_id": doc_old["id"], "new_document_id": "non_existent_doc_888"}
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_compare_valid_policy_versions():
    doc_old, doc_new = setup_comparison_test_documents()
    response = client.post(
        "/api/documents/compare",
        json={"old_document_id": doc_old["id"], "new_document_id": doc_new["id"]}
    )
    assert response.status_code == 200
    data = response.json()
    
    assert data["old_document"]["id"] == doc_old["id"]
    assert data["new_document"]["id"] == doc_new["id"]
    
    comp = data["comparison"]
    assert "summary" in comp
    assert "added" in comp
    assert "removed" in comp
    assert "modified" in comp
    
    # Check that added section 'Remote Work Allowance' is detected
    added_sections = [a["new_section"] for a in comp["added"] if a.get("new_section")]
    assert "Remote Work Allowance" in added_sections
    
    # Check that removed section 'Travel Expense' is detected
    removed_sections = [r["old_section"] for r in comp["removed"] if r.get("old_section")]
    assert "Travel Expense" in removed_sections
    
    # Check page metadata in diff items
    if comp["added"]:
        first_added = comp["added"][0]
        assert "new_page" in first_added
