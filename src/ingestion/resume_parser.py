"""
Resume skill extraction — keyword-based matching (no LLM).
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any
import pdfplumber

def parse_resume_skills(file_buffer: Any, filename: str | None = None) -> list[str]:
    """
    Parses an uploaded file buffer (PDF or TXT) and extracts skills
    using a predefined dictionary of common technical terms.
    """
    text = ""
    if not filename:
        filename = getattr(file_buffer, "filename", "") or getattr(file_buffer, "name", "")
    filename = filename.lower()

    
    # Design choice: Identify file type by extension or signature to read text safely
    if filename.endswith(".pdf") or (hasattr(file_buffer, "getvalue") and file_buffer.getvalue().startswith(b"%PDF")):
        try:
            # pdfplumber is a reliable library for structural PDF text retrieval
            with pdfplumber.open(file_buffer) as pdf:
                text_parts = []
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
                text = "\n".join(text_parts)
        except Exception as e:
            # Fallback if pdfplumber fails to open/parse
            pass
    else:
        try:
            content = file_buffer.read()
            if isinstance(content, bytes):
                text = content.decode("utf-8", errors="ignore")
            else:
                text = content
        except Exception:
            pass
        finally:
            # Always reset buffer cursor for subsequent reads by caller
            if hasattr(file_buffer, "seek"):
                file_buffer.seek(0)
                
    # Vocabulary list of matching technical keywords
    SKILL_LEXICON = {
        "python": "Python",
        "java": "Java",
        "c++": "C++",
        "c#": "C#",
        "javascript": "JavaScript",
        "typescript": "TypeScript",
        "react": "React",
        "angular": "Angular",
        "vue": "Vue",
        "node.js": "Node.js",
        "sql": "SQL",
        "postgresql": "PostgreSQL",
        "mysql": "MySQL",
        "mongodb": "MongoDB",
        "redis": "Redis",
        "django": "Django",
        "flask": "Flask",
        "fastapi": "FastAPI",
        "spring boot": "Spring Boot",
        "docker": "Docker",
        "kubernetes": "Kubernetes",
        "aws": "AWS",
        "git": "Git",
        "machine learning": "Machine Learning",
        "deep learning": "Deep Learning",
        "oops": "OOPS",
        "dbms": "DBMS",
        "operating systems": "Operating Systems",
        "computer networks": "Computer Networks",
        "data structures": "Data Structures",
        "algorithms": "Algorithms"
    }
    
    detected_skills = []
    text_lower = text.lower()
    for kw, display in SKILL_LEXICON.items():
        if kw in text_lower:
            detected_skills.append(display)
            
    # Return matched skills (limit to top 10 to keep chips display neat in UI)
    return detected_skills[:10]
