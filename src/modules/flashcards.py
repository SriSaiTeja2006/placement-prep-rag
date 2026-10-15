"""
Flashcards module.
Generates front/back study flashcards from lecture notes.
"""

from __future__ import annotations

import json
from typing import Any
from config.settings import COLLECTION_NOTES
from src.retrieval.retriever import Retriever
from src.generation.groq_client import GroqClient
from src.modules.quiz_generator import clean_json_response


def generate_flashcards(subject: str, num_cards: int = 10) -> list[dict[str, Any]]:
    """
    Retrieves note chunks and generates flashcards with a front (question) and back (answer).
    """
    if not subject or not subject.strip():
        raise ValueError("Subject search term is required.")

    retriever = Retriever(collection_name=COLLECTION_NOTES)
    retrieved_chunks = retriever.retrieve(subject)

    if not retrieved_chunks:
        raise ValueError("No relevant notes found for this subject. Please upload notes first.")

    context_block, _ = retriever.format_context(retrieved_chunks)

    prompt = f"""You are a study prep assistant. Based ONLY on the lecture notes context below, generate exactly {num_cards} study flashcards.
Each flashcard must contain a "front" (a conceptual question, term, or prompt) and a "back" (the corresponding concise explanation, answer, or definition).

Instructions:
- Keep the front and back text clear and concise.
- Generate cards ONLY from the provided notes context.
- Return ONLY a valid JSON array, with no other text or formatting.
- Do NOT wrap in markdown code block syntax.
- Structure format:
[
  {{
    "front": "Front of card (Question/Term)",
    "back": "Back of card (Answer/Definition)"
  }}
]

Notes Context:
{context_block}
"""

    llm = GroqClient()
    response = llm.generate(prompt)

    try:
        cleaned = clean_json_response(response)
        cards = json.loads(cleaned)
        if not isinstance(cards, list):
            raise ValueError("LLM did not return a JSON list.")
        return cards
    except Exception as e:
        print(f"Flashcard parsing error: {e}. Raw response: {response}")
        raise RuntimeError("Flashcards unavailable. Please try again.") from e
