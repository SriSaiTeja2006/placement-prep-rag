"""
Retrieval evaluation: precision@k against eval/test_questions.json.

A retrieved chunk is "relevant" if its text contains any keyword from the
test case's relevant_keywords list. This is a lightweight proxy metric
suitable for a college project report without manual labeling at scale.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow imports when run as: python eval/evaluate.py
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import TOP_K
from src.embeddings.embedder import Embedder
from src.retrieval.retriever import Retriever
from src.vectorstore.chroma_client import ChromaStore


def precision_at_k(retrieved_texts: list[str], keywords: list[str], k: int) -> float:
    """Fraction of top-k chunks that contain at least one relevant keyword."""
    if k == 0:
        return 0.0
    top = retrieved_texts[:k]
    relevant = 0
    for text in top:
        lower = text.lower()
        if any(kw.lower() in lower for kw in keywords):
            relevant += 1
    return relevant / k


def evaluate(test_file: Path | None = None, k: int | None = None) -> dict:
    k = k or TOP_K
    test_path = test_file or PROJECT_ROOT / "eval" / "test_questions.json"
    cases = json.loads(test_path.read_text(encoding="utf-8"))

    embedder = Embedder()
    store = ChromaStore()
    scores: list[float] = []

    for case in cases:
        collection = case["collection"]
        if store.count(collection) == 0:
            print(f"Skipping '{case['question']}' — collection '{collection}' is empty.")
            continue

        retriever = Retriever(collection, embedder=embedder, store=store, top_k=k)
        chunks = retriever.retrieve(
            case["question"],
            metadata_filter=case.get("metadata_filter"),
        )
        texts = [c["text"] for c in chunks]
        score = precision_at_k(texts, case["relevant_keywords"], k)
        scores.append(score)
        print(f"Q: {case['question'][:60]}...  precision@{k}={score:.2f}")

    avg = sum(scores) / len(scores) if scores else 0.0
    print(f"\nMean precision@{k}: {avg:.2f} ({len(scores)} questions evaluated)")
    return {"mean_precision_at_k": avg, "n_questions": len(scores)}


if __name__ == "__main__":
    evaluate()
