#!/usr/bin/env python3
"""
Phase 1 end-to-end smoke test.

Usage (from placement-prep-rag/):
  python scripts/test_phase1.py
  python scripts/test_phase1.py path/to/your/sample.pdf

Without GROQ_API_KEY, runs ingest + retrieve only (skips LLM generation).
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import COLLECTION_NOTES, GROQ_API_KEY, NOTES_DIR
from src.ingestion.pipeline import IngestionPipeline
from src.vectorstore.chroma_client import ChromaStore


def main() -> None:
    if len(sys.argv) > 1:
        sample_path = Path(sys.argv[1])
    else:
        sample_path = NOTES_DIR / "sample_os_dbms_cn_oops.txt"

    if not sample_path.exists():
        print(f"Sample file not found: {sample_path}")
        print("Pass your PDF path: python scripts/test_phase1.py data/raw/notes/your_file.pdf")
        sys.exit(1)

    print(f"=== Phase 1 Pipeline Test ===")
    print(f"Sample file: {sample_path}")

    store = ChromaStore()
    store.reset_collection(COLLECTION_NOTES)

    pipeline = IngestionPipeline(collection_name=COLLECTION_NOTES, store=store)
    n_chunks = pipeline.ingest_file(sample_path)
    print(f"Ingested {n_chunks} chunks into collection '{COLLECTION_NOTES}'")

    question = "What is a process in operating systems?"
    print(f"\nQuestion: {question}")

    retrieved = pipeline.retriever.retrieve(question)
    print(f"Retrieved {len(retrieved)} chunks")
    for i, chunk in enumerate(retrieved[:3], 1):
        meta = chunk["metadata"]
        preview = chunk["text"][:120].replace("\n", " ")
        print(f"  [{i}] {meta.get('filename')}, p.{meta.get('page_number')} — {preview}...")

    if not GROQ_API_KEY:
        print("\nGROQ_API_KEY not set — skipping LLM generation.")
        print("Add your key to .env to test full RAG answer generation.")
        return

    print("\nGenerating answer via Groq...")
    result = pipeline.answer_question(question)
    print("\n--- Answer ---")
    print(result["answer"])
    print("\n--- Sources ---")
    for src in result["sources"]:
        print(f"  - {src}")


if __name__ == "__main__":
    main()
