#!/usr/bin/env python3
"""
Batch ingestion script.
Checks data/raw/notes/ and data/raw/interview/ for raw documents
and indexes any new files into ChromaDB.
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import COLLECTION_NOTES, COLLECTION_INTERVIEW, NOTES_DIR, INTERVIEW_DIR
from src.ingestion.pipeline import IngestionPipeline
from src.vectorstore.chroma_client import ChromaStore
from src.ingestion.loader import SUPPORTED_EXTENSIONS

def get_already_indexed(store: ChromaStore, collection_name: str) -> set[str]:
    """Retrieve set of filenames already in the collection."""
    try:
        collection = store.get_or_create_collection(collection_name)
        data = collection.get(include=["metadatas"])
        if data and "metadatas" in data and data["metadatas"] is not None:
            files = set()
            for m in data["metadatas"]:
                if m and isinstance(m, dict) and "filename" in m:
                    files.add(m["filename"])
            return files
    except Exception as e:
        print(f"Error querying collection {collection_name}: {e}")
    return set()

def ingest_directory(directory: Path, collection_name: str, store: ChromaStore) -> None:
    if not directory.exists():
        print(f"Directory {directory} does not exist. Skipping.")
        return

    indexed_files = get_already_indexed(store, collection_name)
    print(f"\nScanning {directory.name} directory...")
    
    # Gather candidate files
    files_to_process = []
    for p in directory.iterdir():
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS:
            if p.name in indexed_files:
                print(f"  [Skipped] {p.name} (already indexed)")
            else:
                files_to_process.append(p)
                
    if not files_to_process:
        print("  No new files to index.")
        return

    print(f"  Found {len(files_to_process)} new files to index. Starting pipeline...")
    pipeline = IngestionPipeline(collection_name=collection_name, store=store)
    
    for p in files_to_process:
        print(f"  [Indexing] {p.name} ... ", end="", flush=True)
        try:
            n_chunks = pipeline.ingest_file(p)
            print(f"Success! ({n_chunks} chunks stored)")
        except Exception as e:
            print(f"FAILED: {e}")

def main() -> None:
    print("=== Batch Ingestion Pipeline ===")
    store = ChromaStore()
    
    # 1. Ingest notes
    ingest_directory(NOTES_DIR, COLLECTION_NOTES, store)
    
    # 2. Ingest interview experiences
    ingest_directory(INTERVIEW_DIR, COLLECTION_INTERVIEW, store)
    
    print("\n=== Ingestion Completed! ===")

if __name__ == "__main__":
    main()
