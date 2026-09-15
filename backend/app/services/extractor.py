import fitz  # PyMuPDF
from docx import Document as DocxDocument
import io
import re

def extract_pdf_bytes(file_bytes: bytes):
    """
    Extracts text page-by-page from PDF bytes using PyMuPDF (fitz).
    Preserves page numbers (1-indexed) and page text.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        text = page.get_text("text").strip()
        pages.append({
            "page_number": page_idx + 1,
            "text": text
        })
        
    doc.close()
    return pages


def extract_docx_bytes(file_bytes: bytes):
    """
    Extracts text, paragraphs, and tables from DOCX bytes using python-docx.
    Tracks active section headings (Heading 1, 2, 3) to attach section metadata.
    """
    doc_file = io.BytesIO(file_bytes)
    doc = DocxDocument(doc_file)
    
    sections = []
    current_heading = "General"
    current_text_buffer = []

    def flush_section():
        nonlocal current_text_buffer
        if current_text_buffer:
            combined_text = "\n".join(current_text_buffer).strip()
            if combined_text:
                sections.append({
                    "section_heading": current_heading,
                    "text": combined_text
                })
            current_text_buffer = []

    for para in doc.paragraphs:
        style_name = para.style.name if para.style else ""
        text = para.text.strip()
        
        if not text:
            continue
            
        # Check if paragraph is a heading
        if style_name.startswith("Heading") or re.match(r"^H[1-6]$", style_name, re.IGNORECASE):
            flush_section()
            current_heading = text
        else:
            current_text_buffer.append(text)

    # Process tables if present
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                current_text_buffer.append(row_text)

    flush_section()

    # Fallback if no headings were present
    if not sections and current_text_buffer:
        sections.append({
            "section_heading": "General",
            "text": "\n".join(current_text_buffer).strip()
        })

    return sections
