from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

from app.routers import documents, summary, ask, compare

load_dotenv()

app = FastAPI(
    title="Employment Policy Summarization Assistant API",
    description="Backend API service for document parsing, policy chunking, retrieval, AI summarization, RAG Q&A, and policy version comparison.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev flexibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(documents.router)
app.include_router(summary.router)
app.include_router(ask.router)
app.include_router(compare.router)

@app.get("/api/health")
async def health_check():
    """Health endpoint returning backend operational status."""
    return {
        "status": "ok",
        "message": "Employment Policy Summarization Assistant API is running",
        "service": "employment-policy-assistant-backend"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "127.0.0.1")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
