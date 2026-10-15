"""
Central configuration loaded from .env.

All tunable values live here so modules never hardcode magic numbers.
Paths are resolved relative to the project root (placement-prep-rag/).
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Project root: placement-prep-rag/
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# --- LLM ---
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

# --- Embeddings (local, no API key) ---
EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# --- Chunking ---
# We approximate tokens as words (~1 word ≈ 1 token for English prose).
# 800 words with 120-word overlap ≈ 15% overlap as specified.
CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "800"))
CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "120"))

# --- Retrieval ---
TOP_K: int = int(os.getenv("TOP_K", "5"))

# --- Paths ---
CHROMA_PERSIST_DIR: Path = BASE_DIR / os.getenv("CHROMA_PERSIST_DIR", "chroma_db")
DATA_RAW_DIR: Path = BASE_DIR / "data" / "raw"
DATA_PROCESSED_DIR: Path = BASE_DIR / "data" / "processed"

# Subfolders for raw uploads (used by later modules)
NOTES_DIR: Path = DATA_RAW_DIR / "notes"
INTERVIEW_DIR: Path = DATA_RAW_DIR / "interview_experiences"
RESUMES_DIR: Path = DATA_RAW_DIR / "resumes"
COURSE_NOTES_DIR: Path = DATA_RAW_DIR / "course_notes"

# Collection names in ChromaDB — one per module to prevent cross-context bleed
COLLECTION_NOTES: str = "subject_notes"
COLLECTION_INTERVIEW: str = "interview_experiences"
COLLECTION_RESUMES: str = "resumes"
COLLECTION_ASSIGNMENTS: str = "assignments"
COLLECTION_FLASHCARDS: str = "flashcards"
COLLECTION_STUDY_MATERIAL: str = "study_material"
