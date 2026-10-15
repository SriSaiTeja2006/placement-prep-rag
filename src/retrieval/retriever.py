"""Retrieve top-k chunks and format source citations."""

from __future__ import annotations

from typing import Any

from config.settings import TOP_K
from src.embeddings.embedder import Embedder
from src.vectorstore.chroma_client import ChromaStore


class Retriever:
    """
    Embeds the query and fetches the most similar chunks from ChromaDB.

    Metadata filtering (e.g. company=Amazon) is supported for the interview
    module in Phase 3 — the filter is passed through to Chroma's `where`.
    """

    def __init__(
        self,
        collection_name: str,
        embedder: Embedder | None = None,
        store: ChromaStore | None = None,
        top_k: int | None = None,
    ) -> None:
        self.collection_name = collection_name
        self.embedder = embedder or Embedder()
        self.store = store or ChromaStore()
        self.top_k = top_k or TOP_K

    def retrieve(
        self,
        query: str,
        metadata_filter: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Return ranked chunks with text, metadata, and distance."""
        if self.store.count(self.collection_name) == 0:
            return []

        query_embedding = self.embedder.embed_query(query)
        results = self.store.query(
            collection_name=self.collection_name,
            query_embedding=query_embedding,
            n_results=self.top_k,
            where=metadata_filter,
        )

        return _parse_query_results(results)

    def format_context(
        self,
        chunks: list[dict[str, Any]],
    ) -> tuple[str, list[str]]:
        """
        Build LLM context block and deduplicated citation strings.

        Citations use "filename.pdf, p.N" format for the UI expander.
        """
        context_parts: list[str] = []
        sources: list[str] = []
        seen: set[str] = set()

        for i, chunk in enumerate(chunks, start=1):
            meta = chunk.get("metadata", {})
            filename = meta.get("filename", "unknown")
            page = meta.get("page_number", "?")
            citation = f"{filename}, p.{page}"

            context_parts.append(f"[Source {i}: {citation}]\n{chunk['text']}")

            if citation not in seen:
                seen.add(citation)
                sources.append(citation)

        return "\n\n".join(context_parts), sources


def _parse_query_results(results: dict[str, Any]) -> list[dict[str, Any]]:
    """Flatten ChromaDB nested list response into a list of chunk dicts."""
    chunks: list[dict[str, Any]] = []

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for doc, meta, dist in zip(documents, metadatas, distances):
        if doc:
            chunks.append({"text": doc, "metadata": meta or {}, "distance": dist})

    return chunks
