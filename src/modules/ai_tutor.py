"""
AI Tutor module.
Teaches concepts like a human tutor based on topic and difficulty (Beginner, Intermediate, Advanced).
Outputs a structured study guide with definitions, explanations, examples, and practice questions.
"""

from __future__ import annotations

from typing import Any
from config.settings import COLLECTION_NOTES
from src.retrieval.retriever import Retriever
from src.generation.groq_client import GroqClient

import json

def explain_concept_stream(topic: str, difficulty: str):
    if not topic or not topic.strip():
        yield "Please enter a topic to study."
        return

    try:
        retriever = Retriever(collection_name=COLLECTION_NOTES)
        retrieved_chunks = retriever.retrieve(topic)

        if not retrieved_chunks:
            yield "This topic was not found in your uploaded notes."
            return

        context_block, sources = retriever.format_context(retrieved_chunks)

        prompt = f"""You are a professional university professor and placement coach.

CRITICAL RULES:
1. Ground your response STRICTLY in the provided lecture notes context below.
2. Never use outside knowledge or make things up.
3. If the context is insufficient, reply: "This topic was not found in your uploaded notes."
4. Infer the user's TRUE intent from the context. For example, if the user types "oops" but the retrieved notes are about Object-Oriented Programming (OOP), you should explain OOP — not error handling.
5. Always match the topic to whatever the retrieved notes are actually about.

User's topic query: '{topic}'
Target Audience Level: {difficulty}

You MUST format your output exactly into the following sections with clear markdown headers:

### 1. Definition
Provide a precise definition of the concept appropriate for a {difficulty} level.

### 2. Simple Explanation
Explain the concept using plain English and a memorable analogy.

### 3. Real-Life Example
Describe a real-life industrial application or system design scenario where this is used.

### 4. Step-by-Step Explanation
Break down how it works or how to apply/implement it in clear sequential steps.

### 5. Interview Tips
List keywords, phrases, or conceptual definitions that interviewers look for when testing this topic.

### 6. Common Mistakes
Discuss developer bugs, misconceptions, or common pitfalls related to this concept.

### 7. Related Concepts
Mention 3 related concepts found in notes or system design and how they connect.

### 8. Summary
A 2-sentence summary of the absolute core takeaway.

### 9. Practice Questions
Provide exactly 2 theoretical or technical practice questions to test understanding.

Context from lecture notes:
{context_block}
"""
        llm = GroqClient()
        for chunk in llm.generate_stream(prompt):
            yield chunk

        yield f"\n[SOURCES]:{json.dumps(sources)}"

    except Exception as e:
        yield f"An error occurred in AI Tutor: {e}"
