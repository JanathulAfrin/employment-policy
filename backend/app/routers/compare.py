from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import logging

from app.services.storage import get_document_by_id
from app.services.comparator import compare_policy_documents

router = APIRouter(prefix="/api/documents", tags=["compare"])
logger = logging.getLogger("compare_router")

class CompareDocumentsRequest(BaseModel):
    old_document_id: str = Field(..., description="ID of the older policy document version")
    new_document_id: str = Field(..., description="ID of the newer policy document version")

@router.post("/compare")
async def compare_documents(req: CompareDocumentsRequest):
    """
    Compares two employment policy documents section-by-section to identify
    added, removed, modified, and conflicting provisions with page/section citations.
    """
    old_id = req.old_document_id.strip()
    new_id = req.new_document_id.strip()

    # 1. Validate that old and new document IDs are different
    if old_id == new_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Old and new policy documents must be different. Please select two distinct document versions."
        )

    # 2. Fetch both documents from storage
    old_doc = get_document_by_id(old_id)
    if not old_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Old policy document with ID '{old_id}' not found."
        )

    new_doc = get_document_by_id(new_id)
    if not new_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"New policy document with ID '{new_id}' not found."
        )

    # 3. Check text content availability
    if not old_doc.get("chunks") and not old_doc.get("extracted_data"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Old policy document '{old_doc.get('filename')}' contains no extracted text to compare."
        )

    if not new_doc.get("chunks") and not new_doc.get("extracted_data"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"New policy document '{new_doc.get('filename')}' contains no extracted text to compare."
        )

    # 4. Perform comparison
    try:
        comparison_result = compare_policy_documents(old_doc, new_doc)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare policy documents: {str(e)}"
        )

    return {
        "old_document": {
            "id": old_doc["id"],
            "filename": old_doc["filename"],
            "file_type": old_doc["file_type"]
        },
        "new_document": {
            "id": new_doc["id"],
            "filename": new_doc["filename"],
            "file_type": new_doc["file_type"]
        },
        "comparison": comparison_result
    }
