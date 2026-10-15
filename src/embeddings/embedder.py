"""Local sentence-transformers embedding wrapper — no API key required."""

from __future__ import annotations

from config.settings import EMBEDDING_MODEL


class Embedder:
    """
    Lazy-loads the embedding model on first use.

    all-MiniLM-L6-v2 is small (~80MB) and runs fully locally, which keeps
    the project demo-friendly without cloud embedding costs.
    """

    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or EMBEDDING_MODEL
        self._model = None

    def _get_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)
        return self._model

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        model = self._get_model()
        embeddings = model.encode(texts, show_progress_bar=False)
        return embeddings.tolist()

    def embed_query(self, query: str) -> list[float]:
        return self.embed_texts([query])[0]
