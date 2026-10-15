"""
Quiz Generator module.
Generates customizable quizzes (MCQ, True/False, Fill in blanks, Short Answer) from notes.
"""

from __future__ import annotations

import json
import re
from typing import Any
from config.settings import COLLECTION_NOTES
from src.retrieval.retriever import Retriever
from src.generation.groq_client import GroqClient


def clean_json_response(response: str) -> str:
    """Removes code fences and strips non-JSON text from LLM responses."""
    cleaned = response.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
        cleaned = re.sub(r"\n```$", "", cleaned)
    
    first_idx = min(cleaned.find("["), cleaned.find("{"))
    last_idx = max(cleaned.rfind("]"), cleaned.rfind("}"))
    if first_idx != -1 and last_idx != -1 and last_idx > first_idx:
        cleaned = cleaned[first_idx:last_idx+1]
    return cleaned.strip()


def generate_quiz(
    subject: str | None,
    difficulty: str,
    num_questions: int,
    quiz_type: str,
    filename: str | None = None
) -> list[dict[str, Any]]:
    """
    Retrieves note chunks for the subject (optionally filtered by filename) and generates a quiz.
    
    Returns:
        A list of dictionaries representing questions.
    """
    if (not subject or not subject.strip()) and not filename:
        raise ValueError("Either subject search term or notes file must be selected.")

    retriever = Retriever(collection_name=COLLECTION_NOTES)
    
    metadata_filter = None
    if filename:
        metadata_filter = {"filename": filename}
        
    query = (subject if (subject and subject.strip()) else filename) or ""
    retrieved_chunks = retriever.retrieve(query, metadata_filter=metadata_filter)

    if not retrieved_chunks:
        if filename:
            raise ValueError(f"No indexed content found in '{filename}'. Please make sure it is indexed.")
        raise ValueError("No relevant notes found for this subject. Please upload notes first.")

    context_block, _ = retriever.format_context(retrieved_chunks)

    # Detailed instructions for the LLM based on quiz type
    type_descriptions = {
        "multiple_choice": "Generate Multiple Choice Questions. For each question, provide exactly 4 options.",
        "true_false": "Generate True/False questions. The 'options' field must contain exactly ['True', 'False'].",
        "fill_blanks": "Generate Fill in the Blanks questions. Use '__' (underscores) in the question text. The 'options' list must be empty.",
        "short_answer": "Generate short theoretical questions. The 'options' list must be empty.",
        "coding_concept": "Generate coding concept questions asking what a code snippet does, outputs, or how to resolve a programming task. Provide exactly 4 multiple choice options.",
        "mix": "Generate a mix of Multiple Choice, True/False, and Fill in the Blanks."
    }

    type_inst = type_descriptions.get(quiz_type.lower(), type_descriptions["multiple_choice"])

    prompt = f"""You are an educational quiz master. Based ONLY on the lecture notes below, generate a quiz.
Subject/Topic: {subject}
Difficulty: {difficulty}
Number of questions: {num_questions}
Quiz Type: {quiz_type}

Instructions:
- {type_inst}
- Generate questions ONLY from the provided notes context. Never invent information or use external data.
- Return ONLY a valid JSON array, with no other text, comments, introductions, or formatting.
- Do NOT wrap the JSON in Markdown code block fences (no ```json or ```).
- Each item in the JSON array must follow this exact structure:
[
  {{
    "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "The correct answer string matching options exactly",
    "explanation": "Detailed explanation of the correct answer grounded in the notes"
  }}
]

Notes Context:
{context_block}
"""

    llm = GroqClient()
    response = llm.generate(prompt)

    try:
        cleaned = clean_json_response(response)
        questions = json.loads(cleaned)
        if not isinstance(questions, list):
            raise ValueError("LLM did not return a JSON list.")

        # Validate and sanitize each question to match the expected schema
        REQUIRED_FIELDS = {"question", "correct_answer"}
        validated: list[dict[str, Any]] = []
        for q in questions:
            if not isinstance(q, dict):
                continue
            # Skip items missing critical fields
            if not all(q.get(f) for f in REQUIRED_FIELDS):
                continue
            # Ensure options is always a list (fill_blanks/short_answer may omit it)
            if "options" not in q or not isinstance(q.get("options"), list):
                q["options"] = []
            # Ensure explanation exists
            if "explanation" not in q or not isinstance(q.get("explanation"), str):
                q["explanation"] = ""
            validated.append(q)

        if not validated:
            raise ValueError("LLM returned questions but none had the required fields.")

        return validated
    except Exception as e:
        # Log and raise clear error for route handler
        print(f"Quiz generation parsing error: {e}. Raw response: {response}")
        raise RuntimeError("Quiz could not be generated. Please try again.") from e
