"""
Notes Q&A module — Phase 2.
Implements question answering grounded in class lecture notes.
"""

from __future__ import annotations

from typing import Any
from config.settings import COLLECTION_NOTES
from src.retrieval.retriever import Retriever
from src.generation.groq_client import GroqClient

import json

def answer_subject_question_stream(question: str):
    if not question or not question.strip():
        yield "Please ask a valid question."
        return
        
    try:
        retriever = Retriever(collection_name=COLLECTION_NOTES)
        retrieved_chunks = retriever.retrieve(question)
        
        if not retrieved_chunks:
            yield "This topic was not found in your uploaded notes."
            return
            
        context_block, sources = retriever.format_context(retrieved_chunks)
        
        prompt = f"""You are a technical placement prep assistant. Answer the question below using ONLY the provided lecture notes context.
If the context does not contain enough information, respond with: "This topic was not found in your uploaded notes."

Context:
{context_block}

Question: {question}

Instructions:
- Keep the answer concise and highly structured (use bullet points if appropriate).
- Use professional, interview-ready terminology.
- Never guess or use outside knowledge.
- Cite sources inline in (filename.pdf, p.N) format where applicable.
"""
        llm = GroqClient()
        for chunk in llm.generate_stream(prompt):
            yield chunk
            
        yield f"\n[SOURCES]:{json.dumps(sources)}"
        
    except Exception as e:
        yield f"An error occurred while answering: {e}"
