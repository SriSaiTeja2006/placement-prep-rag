"""End-to-end ingestion: load -> chunk -> embed -> store in ChromaDB."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from src.embeddings.embedder import Embedder
from src.generation.groq_client import GroqClient
from src.generation.llm_interface import LLMInterface
from src.ingestion.chunker import TextChunk, chunk_pages
from src.ingestion.loader import load_file
from src.retrieval.retriever import Retriever
from src.vectorstore.chroma_client import ChromaStore


class IngestionPipeline:
    """
    Orchestrates document ingestion into a named ChromaDB collection.

    Each module (notes, interview, etc.) uses a separate collection so
    retrieval never bleeds across contexts.
    """

    def __init__(
        self,
        collection_name: str,
        embedder: Embedder | None = None,
        store: ChromaStore | None = None,
    ) -> None:
        self.collection_name = collection_name
        self.embedder = embedder or Embedder()
        self.store = store or ChromaStore()
        self.retriever = Retriever(collection_name, embedder=self.embedder, store=self.store)

    def ingest_file(
        self,
        file_path: str | Path,
        extra_metadata: dict[str, Any] | None = None,
    ) -> int:
        """
        Ingest one file into the collection.

        Returns the number of chunks stored.
        """
        pages = load_file(file_path)
        chunks = chunk_pages(pages)
        if not chunks:
            raise ValueError(f"No chunks produced from '{file_path}'")

        embeddings = self.embedder.embed_texts([c.text for c in chunks])
        metadatas = [_chunk_metadata(c, extra_metadata) for c in chunks]
        ids = [f"{c.filename}_{c.chunk_index}" for c in chunks]

        self.store.add_documents(
            collection_name=self.collection_name,
            ids=ids,
            documents=[c.text for c in chunks],
            embeddings=embeddings,
            metadatas=metadatas,
        )
        return len(chunks)

    def answer_question(
        self,
        question: str,
        llm: LLMInterface | None = None,
        metadata_filter: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Full RAG query: retrieve top-k chunks, generate grounded answer.

        Returns dict with 'answer', 'sources', and 'retrieved_chunks'.
        """
        llm = llm or GroqClient()
        retrieved = self.retriever.retrieve(question, metadata_filter=metadata_filter)

        if not retrieved:
            return {
                "answer": "I could not find relevant material in your uploaded documents to answer this question.",
                "sources": [],
                "retrieved_chunks": [],
            }

        context_block, sources = self.retriever.format_context(retrieved)
        prompt = _build_rag_prompt(question, context_block)
        answer = llm.generate(prompt)

        return {
            "answer": answer,
            "sources": sources,
            "retrieved_chunks": retrieved,
        }


def _chunk_metadata(chunk: TextChunk, extra: dict[str, Any] | None) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "filename": chunk.filename,
        "page_number": chunk.page_number,
        "chunk_index": chunk.chunk_index,
    }
    if extra:
        meta.update(extra)
    return meta


def _build_rag_prompt(question: str, context: str) -> str:
    return f"""You are a placement-prep assistant. Answer ONLY using the context below.
If the context does not contain enough information, say so explicitly — do not guess or use outside knowledge.

Context:
{context}

Question: {question}

Instructions:
- Be concise and structured (interview-appropriate, not an essay).
- Cite sources inline as (filename, p.N) when referencing specific facts.
- If context is insufficient, respond: "I don't have enough relevant material to answer this."
"""


def ingest_file(
    file_bytes_or_stream: Any,
    filename: str,
    module: str,
    extra_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Saves an uploaded file to the appropriate raw data folder,
    then runs the IngestionPipeline to load, chunk, embed, and index it.
    """
    from config.settings import NOTES_DIR, INTERVIEW_DIR, COURSE_NOTES_DIR, COLLECTION_NOTES, COLLECTION_INTERVIEW, COLLECTION_ASSIGNMENTS
    
    if module == "interview":
        target_dir = INTERVIEW_DIR
        collection_name = COLLECTION_INTERVIEW
    elif module == "notes":
        target_dir = NOTES_DIR
        collection_name = COLLECTION_NOTES
    elif module == "assignment":
        target_dir = COURSE_NOTES_DIR
        collection_name = COLLECTION_ASSIGNMENTS
    else:
        raise ValueError(f"Unknown module type '{module}'")
        
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / filename
    
    # Save the uploaded file bytes to disk
    if hasattr(file_bytes_or_stream, "read"):
        content = file_bytes_or_stream.read()
        if hasattr(file_bytes_or_stream, "seek"):
            file_bytes_or_stream.seek(0)
    else:
        content = file_bytes_or_stream
        
    if isinstance(content, str):
        file_path.write_text(content, encoding="utf-8")
    else:
        file_path.write_bytes(content)
        
    # Run the ingestion pipeline
    pipeline = IngestionPipeline(collection_name=collection_name)
    chunks_indexed = pipeline.ingest_file(file_path, extra_metadata=extra_metadata)
    
    return {
        "filename": filename,
        "chunks_indexed": chunks_indexed,
        "file_path": str(file_path),
    }

