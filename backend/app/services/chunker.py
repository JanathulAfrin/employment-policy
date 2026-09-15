import uuid
import re

def chunk_text(text: str, max_chunk_size: int = 500, overlap: int = 100):
    """
    Splits text into chunks of target size with specified character overlap.
    Prefers splitting on sentence or paragraph boundaries when possible.
    """
    if not text or not text.strip():
        return []

    # Split into paragraphs first
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        if len(current_chunk) + len(para) + 1 <= max_chunk_size:
            current_chunk = f"{current_chunk}\n{para}".strip() if current_chunk else para
        else:
            if current_chunk:
                chunks.append(current_chunk)
            
            # If paragraph itself exceeds max_chunk_size, sub-split it by sentences
            if len(para) > max_chunk_size:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                sub_chunk = ""
                for sent in sentences:
                    if len(sub_chunk) + len(sent) + 1 <= max_chunk_size:
                        sub_chunk = f"{sub_chunk} {sent}".strip() if sub_chunk else sent
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk)
                        sub_chunk = sent
                if sub_chunk:
                    current_chunk = sub_chunk
                else:
                    current_chunk = ""
            else:
                current_chunk = para

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def chunk_document_data(document_id: str, extracted_data: list, file_type: str):
    """
    Builds structured RAG-ready chunks from extracted PDF pages or DOCX sections.
    Each chunk preserves document_id, chunk_id, text, page_number, and section_heading metadata.
    """
    all_chunks = []
    chunk_index = 0

    if file_type == "pdf":
        for page in extracted_data:
            page_num = page.get("page_number", 1)
            page_text = page.get("text", "")
            raw_chunks = chunk_text(page_text)
            
            for text_snippet in raw_chunks:
                chunk_index += 1
                all_chunks.append({
                    "chunk_id": f"{document_id}_chunk_{chunk_index}",
                    "document_id": document_id,
                    "chunk_index": chunk_index,
                    "text": text_snippet,
                    "page_number": page_num,
                    "section_heading": f"Page {page_num}"
                })
    else:  # docx
        for sec in extracted_data:
            section_heading = sec.get("section_heading", "General")
            sec_text = sec.get("text", "")
            raw_chunks = chunk_text(sec_text)
            
            for text_snippet in raw_chunks:
                chunk_index += 1
                all_chunks.append({
                    "chunk_id": f"{document_id}_chunk_{chunk_index}",
                    "document_id": document_id,
                    "chunk_index": chunk_index,
                    "text": text_snippet,
                    "page_number": None,
                    "section_heading": section_heading
                })

    return all_chunks
