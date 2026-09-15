import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.storage import save_document
from app.services.ai_summarizer import generate_structured_fallback_summary

client = TestClient(app)

def test_summary_nonexistent_document():
    response = client.post("/api/documents/non_existent_doc_123/summary")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_summary_empty_text_document():
    # Save a document with empty chunks
    doc_id = "doc_empty_test_999"
    doc_record = {
        "id": doc_id,
        "filename": "empty_doc.pdf",
        "file_type": "pdf",
        "file_size": 100,
        "upload_timestamp": "2026-09-15T10:00:00Z",
        "page_count": 1,
        "extracted_data": [],
        "chunks": []
    }
    save_document(doc_record)

    response = client.post(f"/api/documents/{doc_id}/summary")
    assert response.status_code == 400
    assert "no extracted text" in response.json()["detail"].lower()


def test_summary_generation_success():
    # Save a valid mock document
    doc_id = "doc_summary_valid_100"
    doc_record = {
        "id": doc_id,
        "filename": "company_leave_policy.pdf",
        "file_type": "pdf",
        "file_size": 2500,
        "upload_timestamp": "2026-09-15T10:00:00Z",
        "page_count": 2,
        "extracted_data": [
            {"page_number": 1, "text": "Annual Leave Policy. Employees are entitled to 20 days paid annual leave. Requests must be submitted 2 weeks in advance."},
            {"page_number": 2, "text": "Medical Leave Policy. Subject to manager approval, employees may take 10 sick days per calendar year."}
        ],
        "chunks": [
            {
                "chunk_id": f"{doc_id}_chunk_1",
                "document_id": doc_id,
                "text": "Annual Leave Policy. Employees are entitled to 20 days paid annual leave. Requests must be submitted 2 weeks in advance.",
                "page_number": 1,
                "section_heading": "Annual Leave"
            },
            {
                "chunk_id": f"{doc_id}_chunk_2",
                "document_id": doc_id,
                "text": "Medical Leave Policy. Subject to manager approval, employees may take 10 sick days per calendar year.",
                "page_number": 2,
                "section_heading": "Medical Leave"
            }
        ]
    }
    save_document(doc_record)

    response = client.post(f"/api/documents/{doc_id}/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["document_id"] == doc_id
    assert "summary" in data
    
    summary = data["summary"]
    # Check JSON Schema keys
    required_keys = [
        "policy_overview", "applies_to", "key_rules", "eligibility_conditions",
        "employee_responsibilities", "exceptions", "important_dates_limits",
        "required_actions", "restrictions", "warnings"
    ]
    for key in required_keys:
        assert key in summary

    # Check source citation structure in key_rules
    assert isinstance(summary["key_rules"], list)
    if summary["key_rules"]:
        first_rule = summary["key_rules"][0]
        assert "text" in first_rule
        assert "page" in first_rule
        assert "section" in first_rule


def test_fallback_summarizer_direct():
    mock_doc = {
        "id": "doc_direct_test",
        "filename": "remote_work.docx",
        "file_type": "docx",
        "chunks": [
            {
                "chunk_id": "chunk_1",
                "text": "Remote employees must log working hours daily by 9 AM. Subject to manager approval.",
                "page_number": None,
                "section_heading": "Remote Work Rules"
            }
        ]
    }
    result = generate_structured_fallback_summary(mock_doc)
    assert "policy_overview" in result
    assert "applies_to" in result
    assert len(result["key_rules"]) > 0
    assert result["key_rules"][0]["section"] == "Remote Work Rules"
