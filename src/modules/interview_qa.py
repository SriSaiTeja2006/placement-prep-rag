"""
Interview prep module — Phase 3.
Implements Q&A grounded in student-uploaded company interview experiences.
"""

from __future__ import annotations

from typing import Any
from config.settings import COLLECTION_INTERVIEW
from src.retrieval.retriever import Retriever
from src.generation.groq_client import GroqClient

def answer_interview_question(
    question: str,
    company: str | None = None
) -> dict[str, Any]:
    """
    Answers interview-related questions based on previous students' interview experiences,
    applying optional filtering by company.
    
    Args:
        question: The user query (e.g. typical topics asked).
        company: Optional name of the company to filter by.
        
    Returns:
        A dictionary containing the compiled answer and sources.
    """
    # 1. Design Choice: Input validation to prevent querying the database with blank search terms
    if not question or not question.strip():
        return {
            "answer": "Please ask a valid interview-related question.",
            "sources": []
        }
        
    try:
        # 2. Design Choice: Build metadata filter for company scope as required by the schema.
        # "All companies" acts as a wildcard, so we skip filtering in that case.
        metadata_filter = None
        if company is not None and company != "All companies":
            metadata_filter = {"company": company}
            
        # 3. Design Choice: Query COLLECTION_INTERVIEW using the shared Retriever
        retriever = Retriever(collection_name=COLLECTION_INTERVIEW)
        retrieved_chunks = retriever.retrieve(question, metadata_filter=metadata_filter)
        
        # 4. Design Choice: Handle empty retrieval cleanly per specifications
        if not retrieved_chunks:
            return {
                "answer": "No interview experiences found for this company.",
                "sources": []
            }
            
        # 5. Design Choice: Format retrieved context and extract unique citation list
        context_block, sources = retriever.format_context(retrieved_chunks)
        
        # 6. Design Choice: Build structured prompt instructing LLM to extract interview details strictly
        prompt = f"""You are a career placement coach. Based ONLY on the interview experiences below, answer the user's question.
Specifically, summarize the following from the context:
- Interview rounds
- Common questions asked
- DSA topics covered
- Coding difficulty levels
- Behavioral expectations

If the context does not contain enough information, respond with: "No interview experiences found for this company."

Context:
{context_block}

Question: {question}

Instructions:
- Ground your response strictly in the provided text.
- Do not make assumptions or generalize from outside knowledge.
- Format the response in clear, concise sections with headers where possible.
"""
        # 7. Design Choice: Call Groq Client through LLMInterface
        llm = GroqClient()
        answer = llm.generate(prompt)
        
        return {
            "answer": answer,
            "sources": sources
        }
        
    except Exception as e:
        # 8. Design Choice: Wrap in generic exception handler to avoid throwing 500 errors in the frontend
        return {
            "answer": f"An error occurred while retrieving interview experiences: {e}",
            "sources": []
        }
