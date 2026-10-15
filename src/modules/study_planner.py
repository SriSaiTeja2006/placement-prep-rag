"""
Study Planner module.
Generates structured daily plans, revision schedules, and custom study goals.
If a target company is specified, retrieves real interview trends to ground placement tips.
"""

from __future__ import annotations

import json
from typing import Any
from config.settings import COLLECTION_INTERVIEW
from src.retrieval.retriever import Retriever
from src.generation.groq_client import GroqClient
from src.modules.quiz_generator import clean_json_response


def generate_study_plan(
    exam_date: str,
    subjects: str,
    daily_hours: float,
    weak_subjects: str,
    target_company: str | None = None
) -> dict[str, Any]:
    """
    Creates a customized daily study schedule and revision guide.
    Queries interview experiences to extract company prep tips if applicable.
    """
    company_context = ""
    if target_company and target_company.strip():
        try:
            retriever = Retriever(collection_name=COLLECTION_INTERVIEW)
            # Find any interview experiences matching the target company
            retrieved = retriever.retrieve(target_company)
            if retrieved:
                context_block, _ = retriever.format_context(retrieved[:3])
                company_context = f"\nTarget Company Interview Experiences Context:\n{context_block}\n"
        except Exception as e:
            print(f"Failed to retrieve company experiences for planner: {e}")

    prompt = f"""You are a career development coach and academic planner. Create a comprehensive, structured study plan.
Inputs:
- Exam Date: {exam_date}
- Subjects: {subjects}
- Daily Study Limit: {daily_hours} hours
- Weak Subjects / Priority Focus: {weak_subjects}
{f'- Target Company: {target_company}' if target_company else ''}
{company_context}

Instructions:
- Design a daily schedule leading up to the exam. Give 5-7 concrete sequential daily tasks.
- Define 3 high-level weekly goals.
- Establish a revision schedule detailing topics and techniques (like active recall).
- Provide 3 academic study tips.
- If target company context is available above, extract specific DSA topics, difficulty levels, or interview rounds mentioned and include them as placement prep milestones.
- Write a short encouraging motivational message.
- Return ONLY a valid JSON object. Do not wrap in markdown or include text outside the JSON.
- The JSON object must match this schema:
{{
  "daily_plan": [
    {{
      "day": "Day 1",
      "topic": "Topic Name",
      "hours": 2.5,
      "tasks": ["Read lecture note chunk 1", "Solve 3 practice questions"]
    }}
  ],
  "weekly_goals": [
    "Goal text"
  ],
  "revision_schedule": [
    {{
      "date": "YYYY-MM-DD",
      "topic": "Topic to revise"
    }}
  ],
  "study_tips": [
    "Tip text"
  ],
  "motivational_message": "An inspiring sentence."
}}
"""

    llm = GroqClient()
    response = llm.generate(prompt)

    try:
        cleaned = clean_json_response(response)
        plan = json.loads(cleaned)
        if not isinstance(plan, dict):
            raise ValueError("LLM did not return a JSON object.")
        return plan
    except Exception as e:
        print(f"Study Planner parsing error: {e}. Raw response: {response}")
        raise RuntimeError("Study plan could not be created. Please try again.") from e
