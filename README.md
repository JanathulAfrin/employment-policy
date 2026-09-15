# Employment Policy Summarization Assistant

An intelligent web application designed for employees and HR teams to upload employment policy documents, understand key guidelines through AI-generated summaries with exact page/section citations, ask grounded questions using RAG, and compare policy versions.

## Project Architecture

```
.
├── backend/            # FastAPI Python server (API, Document Parsing, RAG, AI Summarization, Policy Comparison)
│   ├── app/
│   │   ├── routers/
│   │   │   ├── ask.py         # Grounded RAG Q&A endpoint (POST /api/documents/{doc_id}/ask)
│   │   │   ├── compare.py     # Policy Version Comparison endpoint (POST /api/documents/compare)
│   │   │   ├── documents.py   # Upload & document list endpoints
│   │   │   └── summary.py     # AI policy summarization endpoint
│   │   ├── services/
│   │   │   ├── ai_summarizer.py   # LLM prompt execution & grounded fallback summarizer
│   │   │   ├── chunker.py         # RAG-ready document chunking
│   │   │   ├── comparator.py      # Section-by-section diff comparator engine
│   │   │   ├── extractor.py       # PyMuPDF (PDF) & python-docx (DOCX) text extraction
│   │   │   ├── storage.py         # Local JSON document storage
│   │   │   └── vector_retrieval.py# TF-IDF semantic vector search engine
│   │   └── main.py                # FastAPI entry point with CORS & health check
│   ├── tests/
│   │   ├── test_ask.py        # RAG Q&A & document isolation unit tests
│   │   ├── test_compare.py    # Policy comparison unit tests
│   │   ├── test_documents.py  # Document upload & extraction unit tests
│   │   └── test_summary.py    # AI summary endpoint unit tests
│   ├── .env.example          # Backend env template
│   ├── .gitignore
│   └── requirements.txt
├── frontend/           # React + Vite + Tailwind CSS UI
│   ├── src/
│   │   ├── App.jsx     # Full Dashboard UI (Upload, Summary, Ask Policy, Compare Policies)
│   │   ├── index.css   # Tailwind directives & styles
│   │   └── main.jsx    # React root entry
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
└── README.md
```

## Quick Start Guide

### 1. Backend Setup (FastAPI)

```bash
cd backend
python -m venv venv

# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- API server: `http://localhost:8000`
- Health check: `http://localhost:8000/api/health`
- Upload endpoint: `POST /api/documents/upload`
- Summary endpoint: `POST /api/documents/{document_id}/summary`
- Ask RAG endpoint: `POST /api/documents/{document_id}/ask`
- Comparison endpoint: `POST /api/documents/compare`

### 2. Frontend Setup (React + Vite)

```bash
cd frontend
npm install
npm run dev
```
- Frontend development server: `http://localhost:5173`

## Application Capabilities & Phases
- [x] **Phase 1**: Full-stack monorepo foundation, health endpoint, CORS, and responsive dashboard UI
- [x] **Phase 2**: PDF & DOCX file upload, PyMuPDF & python-docx text extraction, page & section metadata retention, RAG-ready chunking, and storage
- [x] **Phase 3**: AI-powered policy summarization with 10 structured UI categories and source citations
- [x] **Phase 4**: Grounded RAG Q&A chatbot with TF-IDF vector retrieval, document isolation, exact prompt grounding, and clickable evidence cards
- [x] **Phase 5**: Employment Policy Version Comparison with section diffs, page & section citations, and side-by-side visual diff cards
