"""Split page-level text into overlapping chunks with citation metadata."""

from __future__ import annotations

from dataclasses import dataclass

from config.settings import CHUNK_OVERLAP, CHUNK_SIZE
from src.ingestion.loader import PageText


@dataclass
class TextChunk:
    """A chunk ready for embedding, with metadata for source citations."""

    text: str
    filename: str
    page_number: int
    chunk_index: int


def chunk_pages(pages: list[PageText]) -> list[TextChunk]:
    """
    Chunk text with sliding-window overlap.

    We chunk per page first, then apply word-based windows. Keeping page
    boundaries in metadata ensures citations always show the correct page
    even when a chunk spans a partial page.
    """
    chunks: list[TextChunk] = []
    global_index = 0

    for page in pages:
        words = page.text.split()
        if not words:
            continue

        start = 0
        while start < len(words):
            end = min(start + CHUNK_SIZE, len(words))
            chunk_text = " ".join(words[start:end])

            chunks.append(
                TextChunk(
                    text=chunk_text,
                    filename=page.filename,
                    page_number=page.page_number,
                    chunk_index=global_index,
                )
            )
            global_index += 1

            if end >= len(words):
                break
            # Slide forward by (chunk_size - overlap) to create ~15% overlap
            start += max(CHUNK_SIZE - CHUNK_OVERLAP, 1)

    return chunks
