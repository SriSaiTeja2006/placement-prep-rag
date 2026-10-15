"""
Assignment helper module — Phase 5 Upgrades.
Provides high-level design approaches, pseudocode, tags, and citations without yielding runnable code.
"""

from __future__ import annotations

import re
from typing import Any
from config.settings import COLLECTION_ASSIGNMENTS, COLLECTION_NOTES
from src.retrieval.retriever import Retriever
from src.generation.groq_client import GroqClient

def contains_compilable_code(text: str) -> bool:
    """
    Validate server-side that the output contains no compilable programming language codes.
    Checks for common markup wrappers, function declarations, and main block methods.
    """
    # Reject common language code block wrappers
    for lang in ["```python", "```cpp", "```java", "```c", "```javascript", "```go", "```rust"]:
        if lang in text.lower():
            return True

    # Regex checks for full function definitions or common code syntaxes
    patterns = [
        r"def\s+\w+\s*\(.*\)\s*:",                 # Python function
        r"public\s+class\s+\w+",                   # Java class
        r"public\s+static\s+void\s+main",          # Java main method
        r"int\s+main\s*\(.*\)",                    # C/C++ main
        r"#include\s+<\w+>",                       # C/C++ include header
        r"std::cout",                              # C++ print
        r"System\.out\.println",                   # Java print
        r"console\.log\s*\(",                      # JS print
        r"func\s+\w+\s*\(.*\)\s*{"                 # Go function
    ]
    for pattern in patterns:
        if re.search(pattern, text):
            return True
    return False

def get_assignment_guidance(
    problem_statement: str,
    unit_name: str | None = None,
    hint_level: int = 1
) -> dict[str, Any]:
    """
    Retrieves relevant course notes (primary) and core concept notes (fallback),
    and queries Groq to generate a custom conceptual plan.
    Enforces academic integrity using a validation re-prompt guardrail loop.
    """
    if not problem_statement or not problem_statement.strip():
        return {
            "approach": "Please enter a valid problem statement.",
            "pseudocode": "",
            "difficulty": "Medium",
            "concept_tags": [],
            "source_refs": []
        }

    # 1. Determine retrieval limits based on Hint Level
    if hint_level == 0:
        limit = 1
    elif hint_level == 1:
        limit = 3
    else:
        limit = 5

    retrieved_chunks = []
    source_refs = []

    # 2. Primary query: Student's own uploaded course notes (COLLECTION_ASSIGNMENTS)
    try:
        retriever_assignments = Retriever(collection_name=COLLECTION_ASSIGNMENTS, top_k=limit)
        metadata_filter = {"unit_name": unit_name} if unit_name else None
        
        # Query primary collection
        course_chunks = retriever_assignments.retrieve(
            problem_statement,
            metadata_filter=metadata_filter
        )
        if course_chunks:
            retrieved_chunks.extend(course_chunks)
            for c in course_chunks:
                meta = c.get("metadata", {})
                # Format a friendly source reference
                fn = meta.get("filename") or meta.get("source_file") or "Notes"
                pn = meta.get("page_number") or 1
                source_refs.append(f"{fn} (p. {pn})")
    except Exception as e:
        print(f"Primary course notes retrieval skipped/failed: {e}")

    # 3. Fallback query: Core Concepts knowledge base (COLLECTION_NOTES)
    if len(retrieved_chunks) < limit:
        try:
            remaining_limit = limit - len(retrieved_chunks)
            retriever_notes = Retriever(collection_name=COLLECTION_NOTES, top_k=remaining_limit)
            fallback_chunks = retriever_notes.retrieve(problem_statement)
            if fallback_chunks:
                retrieved_chunks.extend(fallback_chunks)
                for c in fallback_chunks:
                    meta = c.get("metadata", {})
                    fn = meta.get("filename") or "Core concepts"
                    pn = meta.get("page_number") or 1
                    source_refs.append(f"{fn} (p. {pn})")
        except Exception as e:
            print(f"Fallback concepts retrieval skipped/failed: {e}")

    # Unique citations list
    source_refs = sorted(list(set(source_refs)))

    # Format context block
    context_block = ""
    context_parts = []
    for i, chunk in enumerate(retrieved_chunks):
        meta = chunk.get("metadata", {})
        fn = meta.get("filename") or "notes"
        context_parts.append(f"[Source {i+1}: {fn}]\n{chunk.get('text', '')}")
    context_block = "\n\n".join(context_parts)

    # 4. Formulate Prompt based on Hint Level strategy
    if hint_level == 0:
        hint_strategy = """Strategy: Nudge.
- Provide a brief conceptual pointer or hint.
- Do NOT mention the names of specific algorithms or data structures.
- Constrain output to 1-2 sentences."""
    elif hint_level == 1:
        hint_strategy = """Strategy: Concept.
- Explain which core data structure or algorithm fits the problem.
- Explain WHY it fits.
- Do NOT provide a step-by-step logic sequence, lists of operations, or code."""
    else:
        hint_strategy = """Strategy: Pseudocode.
- Provide full relevant logical sections and structured pseudocode.
- Explicitly map it to the retrieved lecture notes context.
- Keep the pseudocode highly abstract (using descriptive variables, loops, checks) so it remains non-compilable."""

    system_prompt = f"""You are an academic assignment helper assisting a student. Ground your support strictly in the provided Notes Context.
Your goal is to guide the student conceptually. You MUST adhere to academic integrity:
- Do NOT output compilable programming language code (Python, Java, C++, JS, etc.).
- Do NOT write runnable function bodies or scripts. If asked for code, refuse and offer conceptual pseudocode instead.

{hint_strategy}

You MUST self-classify the problem's difficulty (Easy, Medium, Hard) and extract 3 to 6 concept tags (as hashtags e.g. #semaphores).

You MUST format your entire response exactly as follows:
APPROACH:
<conceptual explanation according to strategy>

PSEUDOCODE:
<abstract pseudocode if Pseudocode strategy is chosen, otherwise leave empty>

DIFFICULTY:
<Easy, Medium, or Hard>

TAGS:
<comma-separated hashtags e.g. #semaphores, #mutual-exclusion>
"""

    prompt = f"""{system_prompt}

Notes Context:
{context_block if context_block else "No notes available for this topic."}

Problem Statement:
{problem_statement}
"""

    # 5. LLM Call with Server-Side Guardrail loop (up to 2 retries)
    llm = GroqClient()
    response = llm.generate(prompt)

    retries = 2
    while contains_compilable_code(response) and retries > 0:
        print(f"Guardrail triggered: code detected in response. Retrying LLM call. Retries left: {retries}")
        re_prompt = f"""{prompt}
        
        WARNING: Your previous response contained runnable/compilable programming code. 
        You MUST rewrite the explanation using ONLY high-level conceptual approaches and abstract pseudocode. 
        Absolutely no code blocks or language-specific constructs are permitted.
        """
        response = llm.generate(re_prompt)
        retries -= 1

    # Safe fallback if LLM keeps generating code after retries
    if contains_compilable_code(response):
        print("Guardrail final safety triggered: cleaning code syntax tags.")
        response = re.sub(r"```[a-zA-Z0-9]*\n", "```text\n", response)

    # 6. Parse response sections
    approach = ""
    pseudocode = ""
    difficulty = "Medium"
    concept_tags = []

    # Parse Approach
    app_match = re.search(r"APPROACH:(.*?)(PSEUDOCODE:|DIFFICULTY:|$)", response, re.DOTALL | re.IGNORECASE)
    if app_match:
        approach = app_match.group(1).strip()
    else:
        approach = response

    # Parse Pseudocode
    ps_match = re.search(r"PSEUDOCODE:(.*?)(DIFFICULTY:|TAGS:|$)", response, re.DOTALL | re.IGNORECASE)
    if ps_match:
        pseudocode = ps_match.group(1).strip()

    # Parse Difficulty
    diff_match = re.search(r"DIFFICULTY:\s*(Easy|Medium|Hard)", response, re.IGNORECASE)
    if diff_match:
        difficulty = diff_match.group(1).strip().capitalize()

    # Parse Tags
    tags_match = re.search(r"TAGS:(.*?)$", response, re.DOTALL | re.IGNORECASE)
    if tags_match:
        raw_tags = tags_match.group(1).strip()
        concept_tags = [t.strip() for t in raw_tags.split(",") if t.strip()]

    # Fail-safe hashtags parsing
    if not concept_tags:
        # Fallback to extracting words starting with #
        concept_tags = re.findall(r"#\w+", response)
    
    # Ensure they start with #
    concept_tags = [t if t.startswith('#') else '#' + t for t in concept_tags]

    # Clean up tags formatting
    concept_tags = [t.replace('#', '') for t in concept_tags] # JS will add # back if missing

    return {
        "approach": approach,
        "pseudocode": pseudocode,
        "difficulty": difficulty,
        "concept_tags": concept_tags,
        "source_refs": source_refs
    }

def get_assignment_help(problem_statement: str) -> dict[str, Any]:
    """
    Wrapper to preserve compatibility with existing API endpoints.
    Uses default hint level.
    """
    res = get_assignment_guidance(problem_statement, hint_level=1)
    return {
        "approach": res["approach"],
        "pseudocode": res["pseudocode"],
        "sources": res["source_refs"]
    }
