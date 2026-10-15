"""Persistent ChromaDB wrapper for add/query operations."""

from __future__ import annotations

from typing import Any, cast

import chromadb
from chromadb.config import Settings as ChromaSettings

from config.settings import CHROMA_PERSIST_DIR


class ChromaStore:
    """
    Thin wrapper around ChromaDB's persistent client.

    We use separate collections per module (notes, interview, etc.) so
    retrieval stays scoped and never mixes unrelated document types.
    """

    def __init__(self, persist_dir: str | None = None) -> None:
        self.persist_dir = str(persist_dir or CHROMA_PERSIST_DIR)
        self._client = chromadb.PersistentClient(
            path=self.persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

    def get_or_create_collection(self, name: str):
        return self._client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    def add_documents(
        self,
        collection_name: str,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]],
    ) -> None:
        collection = self.get_or_create_collection(collection_name)
        collection.add(
            ids=ids,
            documents=documents,
            embeddings=cast(Any, embeddings),
            metadatas=cast(Any, metadatas),
        )

    def query(
        self,
        collection_name: str,
        query_embedding: list[float],
        n_results: int,
        where: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        collection = self.get_or_create_collection(collection_name)
        kwargs: dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": n_results,
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            kwargs["where"] = where
        return cast(dict[str, Any], collection.query(**kwargs))

    def count(self, collection_name: str) -> int:
        collection = self.get_or_create_collection(collection_name)
        return collection.count()

    def reset_collection(self, collection_name: str) -> None:
        """Delete and recreate a collection (useful for notebook demos)."""
        try:
            self._client.delete_collection(collection_name)
        except Exception:
            pass
        self.get_or_create_collection(collection_name)
