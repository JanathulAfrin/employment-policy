from fastapi import APIRouter, UploadFile, File, HTTPException, status
import uuid
import datetime
import os
from app.services.extractor import extract_pdf_bytes, extract_docx_bytes
from app.services.chunker import chunk_document_data
from app.services.storage import save_document, load_documents, get_document_by_id, delete_document
from app.services.stats import get_real_system_stats

router = APIRouter(prefix="/api", tags=["documents"])

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB limit

@router.get("/stats")
async def get_system_stats():
    """Returns live, real backend metrics (policies uploaded, processed, summaries, questions asked)."""
    return get_real_system_stats()

@router.get("/documents")
async def list_documents():
    """Returns list of uploaded policy documents."""
    docs = load_documents()
    summary_list = []
    for d in docs:
        summary_list.append({
            "id": d["id"],
            "filename": d["filename"],
            "file_type": d["file_type"],
            "file_size": d["file_size"],
            "upload_timestamp": d["upload_timestamp"],
            "page_count": d.get("page_count"),
            "section_count": d.get("section_count"),
            "chunk_count": d.get("chunk_count", 0),
            "status": d.get("status", "processed"),
            "has_summary": d.get("summary") is not None
        })
    return summary_list

@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Accepts PDF or DOCX file upload, extracts page/section content,
    chunks the text while preserving metadata, and stores document metadata locally.
    """
    filename = file.filename or "unknown_file"
    ext = os.path.splitext(filename)[1].lower()
    
    # 1. Validate file extension
    if ext not in [".pdf", ".docx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Only PDF (.pdf) and Word DOCX (.docx) documents are supported."
        )

    # 2. Read file contents & validate size/emptiness
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file stream: {str(e)}"
        )

    if not file_bytes or len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum allowed limit of 15MB."
        )

    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    file_type = "pdf" if ext == ".pdf" else "docx"
    upload_timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # 3. Extract text page-by-page or section-by-section
    try:
        if file_type == "pdf":
            extracted_data = extract_pdf_bytes(file_bytes)
        else:
            extracted_data = extract_docx_bytes(file_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to extract document contents: {str(e)}"
        )

    total_extracted_text = " ".join(
        item.get("text", "") for item in extracted_data
    ).strip()

    if not total_extracted_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document appears to be empty or contains no extractable text content."
        )

    # 4. Generate RAG-ready chunks with metadata
    chunks = chunk_document_data(doc_id, extracted_data, file_type)

    # 5. Build Document Record
    doc_record = {
        "id": doc_id,
        "filename": filename,
        "file_type": file_type,
        "file_size": len(file_bytes),
        "upload_timestamp": upload_timestamp,
        "page_count": len(extracted_data) if file_type == "pdf" else None,
        "section_count": len(extracted_data) if file_type == "docx" else None,
        "chunk_count": len(chunks),
        "status": "processed",
        "extracted_data": extracted_data,
        "chunks": chunks,
        "summary": None
    }

    # 6. Save locally
    save_document(doc_record)

    return {
        "message": "Policy uploaded and processed successfully.",
        "document": {
            "id": doc_record["id"],
            "filename": doc_record["filename"],
            "file_type": doc_record["file_type"],
            "file_size": doc_record["file_size"],
            "upload_timestamp": doc_record["upload_timestamp"],
            "page_count": doc_record["page_count"],
            "section_count": doc_record["section_count"],
            "chunk_count": doc_record["chunk_count"],
            "status": doc_record["status"]
        }
    }

@router.get("/documents/{document_id}")
async def get_document(document_id: str):
    """Retrieves document details including extracted pages/sections and chunks."""
    doc = get_document_by_id(document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found."
        )
    return doc

@router.delete("/documents/{document_id}")
async def delete_document_endpoint(document_id: str):
    """Deletes uploaded document from storage."""
    deleted = delete_document(document_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found."
        )
    return {"message": f"Document '{document_id}' deleted successfully."}
