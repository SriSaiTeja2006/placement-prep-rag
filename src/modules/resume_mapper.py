"""
Resume-to-question mapper — Phase 4.
Extracts resume skills locally and maps them to historical interview questions.
"""

from __future__ import annotations

from typing import Any
from config.settings import COLLECTION_INTERVIEW
from src.ingestion.resume_parser import parse_resume_skills
from src.retrieval.retriever import Retriever
from src.generation.groq_client import GroqClient

def get_resume_skills(file_buffer: Any, filename: str | None = None) -> list[str]:
    """
    Extracts skills from a resume document buffer.
    
    Args:
        file_buffer: BytesIO or file-like buffer of the uploaded resume.
        filename: Optional name of the file to determine type/extension.
        
    Returns:
        A list of detected technical skills.
    """
    # 1. Design Choice: Enforce requirement of using ONLY the shared resume parser and no LLM
    try:
        return parse_resume_skills(file_buffer, filename)
    except Exception:
        # Fallback to empty list if parsing fails
        return []

def generate_questions(skill: str) -> list[str]:
    """
    Retrieves previous interview experience chunks related to the skill and
    generates exactly 3 relevant interview questions using Groq.
    
    Args:
        skill: A specific technical skill name.
        
    Returns:
        A list of exactly 3 interview questions.
    """
    # 2. Design Choice: Check input validity before query execution
    if not skill or not skill.strip():
        return []
        
    print(f"Detected Skill: {skill}")
        
    try:
        # Check if the collection exists and has documents
        from src.vectorstore.chroma_client import ChromaStore
        store = ChromaStore()
        if store.count(COLLECTION_INTERVIEW) == 0:
            raise ValueError("Please upload interview experience documents before using Resume Mapper.")

        # 3. Design Choice: Retrieve interview experience chunks related to the skill
        retriever = Retriever(collection_name=COLLECTION_INTERVIEW)
        retrieved_chunks = retriever.retrieve(skill)
        
        # Print Debug logs
        print(f"Retrieved Chunk Count: {len(retrieved_chunks)}")
        unique_docs = sorted(list(set(chunk.get("metadata", {}).get("filename", "unknown") for chunk in retrieved_chunks)))
        print(f"Retrieved Documents: {unique_docs}")
        
        # 4. Design Choice: If retrieval fails or has no matches, return an empty list as specified
        if not retrieved_chunks:
            return []
            
        # 5. Design Choice: Construct the prompt targeting exactly 3 questions grounded in experiences
        context_block, _ = retriever.format_context(retrieved_chunks)
        prompt = f"""You are a technical interviewer. Based ONLY on the interview experiences below, generate EXACTLY 3 interview questions that focus on testing the skill: '{skill}'.

Interview Experiences:
{context_block}

Instructions:
- Output exactly 3 questions.
- Return only the questions themselves, each on a new line.
- Do not include numbering, bullet symbols (like -, *), introductions, or explanations.
- Generate EXACTLY 3 interview questions based ONLY on the retrieved interview experiences.
"""
        # Print Debug log
        print(f"Prompt Sent To Groq:\n{prompt}")

        # 6. Design Choice: Call the shared GroqClient interface
        llm = GroqClient()
        response = llm.generate(prompt)
        
        # Print Debug log
        print(f"Groq Response:\n{response}")
        
        # 7. Design Choice: Parse response lines to remove bullet points or numbers
        questions = []
        for line in response.split("\n"):
            line = line.strip()
            if not line:
                continue
                
            # Strip numbers, bullets, and surrounding quotes if LLM added them
            cleaned = line.lstrip("0123456789.-*• \t").strip().strip('"\'')
            if cleaned and len(cleaned) > 10:
                questions.append(cleaned)
                
        # Return exactly the top 3 parsed questions
        return questions[:3]
        
    except Exception as e:
        import traceback
        print("ERROR IN generate_questions:")
        traceback.print_exc()
        if isinstance(e, ValueError):
            raise e
        raise RuntimeError("Unable to generate interview questions right now.") from e
