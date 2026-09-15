from fastapi import APIRouter, HTTPException, status
from app.services.storage import get_document_by_id, save_document
from app.services.ai_summarizer import summarize_policy_document

router = APIRouter(prefix="/api/documents", tags=["summary"])

@router.post("/{document_id}/summary")
async def generate_document_summary(document_id: str):
    """
    Generates an AI-powered, grounded employment policy summary for the given document ID.
    Returns structured JSON with policy overview, rules, requirements, and citations.
    """
    # 1. Fetch document from storage
    doc = get_document_by_id(document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found."
        )

    # 2. Check extracted text availability
    chunks = doc.get("chunks", [])
    extracted_data = doc.get("extracted_data", [])
    
    if not chunks and not extracted_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document has no extracted text content to summarize."
        )

    # 3. Generate summary via AI summarizer service
    try:
        summary_result = summarize_policy_document(doc)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate policy summary: {str(e)}"
        )

    # 4. Save generated summary in document record for caching
    doc["summary"] = summary_result
    save_document(doc)

    return {
        "document_id": document_id,
        "filename": doc.get("filename"),
        "summary": summary_result
    }


@router.get("/{document_id}/summary")
async def get_cached_document_summary(document_id: str):
    """Retrieves cached document summary if previously generated."""
    doc = get_document_by_id(document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found."
        )

    summary = doc.get("summary")
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Summary for document '{document_id}' has not been generated yet. Use POST /api/documents/{document_id}/summary."
        )

    return {
        "document_id": document_id,
        "filename": doc.get("filename"),
        "summary": summary
    }
