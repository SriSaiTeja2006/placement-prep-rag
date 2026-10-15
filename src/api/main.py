import sys
from pathlib import Path
from typing import Optional, List, Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException, Request
from fastapi.responses import RedirectResponse, HTMLResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from src.ingestion.pipeline import ingest_file
from src.modules.subject_qa import answer_subject_question_stream
from src.modules.interview_qa import answer_interview_question
from src.modules.resume_mapper import get_resume_skills, generate_questions
from src.modules.assignment_helper import get_assignment_help
from src.modules.ai_tutor import explain_concept_stream
from src.modules.quiz_generator import generate_quiz
from src.modules.flashcards import generate_flashcards
from src.modules.study_planner import generate_study_plan
from config.settings import COLLECTION_NOTES, COLLECTION_INTERVIEW
from src.modules.analytics_dashboard import get_analytics_data, log_event

# Initialize FastAPI App
app = FastAPI(title="Placement Prep RAG API", version="0.1.0")

# CORS Middleware (allows stream/frontend requests without browser blocks)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prevent caching of static files and templates during development
@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/static") or path.startswith("/views") or path == "/":
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Serve Static Files
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Jinja2 Template Directory
templates = Jinja2Templates(directory="frontend/templates")


# --- Request & Response Models ---

class SubjectQARequest(BaseModel):
    question: str

class QAResponse(BaseModel):
    answer: str
    sources: List[str]

class InterviewQARequest(BaseModel):
    question: str
    company: Optional[str] = None

class InterviewPasteRequest(BaseModel):
    company: str
    role: str = "General"
    round_type: str = "General"
    text: str
    source: str = "paste"

class InterviewResearchRequest(BaseModel):
    company: str
    role: str = "General"
    round_type: str = "General"

class ResumeQuestionsRequest(BaseModel):
    skill: str

class QuestionsResponse(BaseModel):
    skill: str
    questions: List[str]

class AssignmentHelpRequest(BaseModel):
    problem_statement: str

class AssignmentHelpResponse(BaseModel):
    approach: str
    pseudocode: str
    sources: List[str]

class AssignmentQueryRequest(BaseModel):
    problem_statement: str
    unit_name: Optional[str] = None
    hint_level: int = 1

class AssignmentQueryResponse(BaseModel):
    approach: str
    pseudocode: str
    difficulty: str
    concept_tags: List[str]
    source_refs: List[str]

class IngestResponse(BaseModel):
    filename: str
    chunks_indexed: int

class SkillsResponse(BaseModel):
    skills: List[str]


# --- AI Tutor Schemas ---
class TutorRequest(BaseModel):
    topic: str
    difficulty: str

class TutorResponse(BaseModel):
    explanation: str
    sources: List[str]


# --- Quiz Generator Schemas ---
class QuizRequest(BaseModel):
    subject: Optional[str] = None
    difficulty: str
    num_questions: int
    quiz_type: str
    filename: Optional[str] = None

class QuizQuestion(BaseModel):
    question: str
    options: List[str] = []
    correct_answer: str
    explanation: str = ""

class QuizResponse(BaseModel):
    questions: List[QuizQuestion]


# --- Flashcards Schemas ---
class FlashcardRequest(BaseModel):
    subject: str
    num_cards: int

class FlashcardItem(BaseModel):
    front: str
    back: str

class FlashcardResponse(BaseModel):
    cards: List[FlashcardItem]


# --- Study Planner Schemas ---
class StudyPlanRequest(BaseModel):
    exam_date: str
    subjects: str
    daily_hours: float
    weak_subjects: str
    target_company: Optional[str] = None

class DailyPlanDay(BaseModel):
    day: str
    topic: str
    hours: float
    tasks: List[str]

class RevisionDay(BaseModel):
    date: str
    topic: str

class StudyPlanResponse(BaseModel):
    daily_plan: List[DailyPlanDay]
    weekly_goals: List[str]
    revision_schedule: List[RevisionDay]
    study_tips: List[str]
    motivational_message: str

class QuizLogRequest(BaseModel):
    subject: str
    difficulty: str
    score: str
    correct: int
    wrong: int


# --- Endpoints ---

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def read_root(request: Request):
    """Serve the index page of the application."""
    return templates.TemplateResponse(request, "index.html", {"request": request})


@app.get("/pdf/{filename}", include_in_schema=False)
def get_pdf(filename: str):
    """Serve PDF document for source citations."""
    from config.settings import NOTES_DIR, INTERVIEW_DIR, RESUMES_DIR, COURSE_NOTES_DIR
    
    search_dirs = [
        NOTES_DIR,
        INTERVIEW_DIR,
        RESUMES_DIR,
        COURSE_NOTES_DIR,
        PROJECT_ROOT / "data" / "documents"
    ]
    
    for directory in search_dirs:
        file_path = directory / filename
        if file_path.exists() and file_path.is_file():
            return FileResponse(path=file_path, media_type="application/pdf")
            
    error_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Document Not Found</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
        <style>
            body {{ font-family: 'Poppins', sans-serif; background-color: #0A0A0A; color: #FAFAFA; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }}
            .container {{ text-align: center; background: #181818; padding: 40px; border-radius: 16px; border: 1px solid #2A2A2A; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
            h1 {{ color: #EF4444; margin-top: 0; }}
            p {{ color: #A1A1AA; line-height: 1.6; }}
            .filename {{ display: inline-block; background: #2A2A2A; color: #7DD3FC; padding: 4px 8px; border-radius: 6px; margin: 10px 0; word-break: break-all; font-family: monospace; font-size: 13px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Document Not Found</h1>
            <p>The AI cited the following file, but it could not be found on your disk:</p>
            <div class="filename">{filename}</div>
            <p><strong>Why did this happen?</strong><br>This usually occurs when a PDF was previously uploaded and indexed into the AI's memory, but the original file was later deleted or moved from the <code>data/raw/notes</code> folder.</p>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=error_html, status_code=404)


@app.get("/views/{name}", response_class=HTMLResponse, include_in_schema=False)
def get_view(request: Request, name: str):
    """Serve individual module templates dynamically."""
    try:
        return templates.TemplateResponse(request, f"{name}.html", {"request": request})
    except Exception:
        raise HTTPException(status_code=404, detail="View template not found")


@app.get("/api/indexed-files")
def get_indexed_files_api(module: str = Query("notes")):
    """Get list of indexed files for a specific module by scanning raw files."""
    try:
        from config.settings import NOTES_DIR, INTERVIEW_DIR
        target_dir = NOTES_DIR if module == "notes" else INTERVIEW_DIR
        if target_dir.exists():
            from src.ingestion.loader import SUPPORTED_EXTENSIONS
            files = [
                p.name for p in target_dir.iterdir()
                if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
            ]
            return {"files": sorted(files)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"files": []}



@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok"}



@app.post("/subject-qa")
def subject_qa(request: SubjectQARequest):
    """Ask a question grounded in your uploaded subject notes (streamed)."""
    try:
        log_event("qa", {})
        return StreamingResponse(
            answer_subject_question_stream(request.question), 
            media_type="text/event-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/interview-qa", response_model=QAResponse)
def interview_qa(request: InterviewQARequest):
    """Ask a question grounded in historical interview experiences, optionally filtered by company."""
    try:
        result = answer_interview_question(request.question, company=request.company)
        log_event("interview_ask", {})
        return QAResponse(
            answer=result["answer"],
            sources=result["sources"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/resume/skills", response_model=SkillsResponse)
def upload_resume_for_skills(file: UploadFile = File(..., description="Upload a PDF or TXT resume to extract skills")):
    """Upload a resume (PDF/TXT) to extract key technical skills (no LLM)."""
    try:
        skills = get_resume_skills(file.file, filename=file.filename)
        strength = min(15 + len(skills) * 8, 95)
        log_event("resume_uploaded", {"skills": skills, "strength_score": strength})
        return SkillsResponse(skills=skills)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/resume/questions", response_model=QuestionsResponse)
def resume_questions(request: ResumeQuestionsRequest):
    """Generate exactly 3 interview questions based on company history for a specific skill."""
    try:
        questions = generate_questions(request.skill)
        return QuestionsResponse(
            skill=request.skill,
            questions=questions
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/assignment-help", response_model=AssignmentHelpResponse)
def assignment_help(request: AssignmentHelpRequest):
    """Get conceptual approach and pseudocode help for an assignment without runnable code."""
    try:
        result = get_assignment_help(request.problem_statement)
        log_event("assignment", {})
        return AssignmentHelpResponse(
            approach=result["approach"],
            pseudocode=result["pseudocode"],
            sources=result["sources"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/assignment/upload", response_model=IngestResponse)
def upload_assignment_notes(
    file: UploadFile = File(..., description="Upload a lecture note PDF or TXT to index"),
    course_id: str = Form("CS-101", description="Course identifier"),
    unit_name: str = Form("General", description="Unit name or topic")
):
    """Ingest lecture notes for assignment grounding."""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")
        
        safe_course = course_id.replace(' ', '-')
        safe_unit = unit_name.replace(' ', '-')
        filename = f"assignment_{safe_course}_{safe_unit}_{file.filename}"
        
        result = ingest_file(
            file.file, filename,
            module="assignment",
            extra_metadata={
                "course_id": course_id,
                "unit_name": unit_name,
                "upload_date": "2026-07-16"
            }
        )
        return IngestResponse(
            filename=result["filename"],
            chunks_indexed=result["chunks_indexed"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/assignment/query", response_model=AssignmentQueryResponse)
def query_assignment_plan(request: AssignmentQueryRequest):
    """Retrieve grounded context and generate step-by-step conceptual hints."""
    try:
        from src.modules.assignment_helper import get_assignment_guidance
        result = get_assignment_guidance(
            problem_statement=request.problem_statement,
            unit_name=request.unit_name,
            hint_level=request.hint_level
        )
        log_event("assignment_query", {"difficulty": result["difficulty"]})
        return AssignmentQueryResponse(
            approach=result["approach"],
            pseudocode=result["pseudocode"],
            difficulty=result["difficulty"],
            concept_tags=result["concept_tags"],
            source_refs=result["source_refs"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/notes/upload", response_model=IngestResponse)
def upload_notes(file: UploadFile = File(..., description="Upload a PDF or TXT note file to index")):
    """Upload and index a subject lecture notes file."""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")
        result = ingest_file(file.file, file.filename, module="notes")
        return IngestResponse(
            filename=result["filename"],
            chunks_indexed=result["chunks_indexed"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/interview/upload", response_model=IngestResponse)
def upload_interview(
    file: UploadFile = File(..., description="Upload an interview experience PDF or TXT file to index"),
    company: str = Form(..., description="Company name associated with this experience")
):
    """Upload and index an interview experience file tagged with a specific company."""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")
        safe_company = company.replace(' ', '-')
        tagged_filename = f"upload_{safe_company}_{file.filename}"
        result = ingest_file(
            file.file, tagged_filename,
            module="interview",
            extra_metadata={"company": company}
        )
        return IngestResponse(
            filename=result["filename"],
            chunks_indexed=result["chunks_indexed"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/interview/paste", response_model=IngestResponse)
def paste_interview_experience(request: InterviewPasteRequest):
    """Log a pasted interview experience as text and index it."""
    try:
        safe_company = request.company.replace(' ', '-')
        safe_round = request.round_type.replace(' ', '-')
        source_prefix = request.source if request.source in ('paste', 'research') else 'paste'
        filename = f"{source_prefix}_{safe_company}_{safe_round}.txt"

        result = ingest_file(
            request.text,
            filename,
            module="interview",
            extra_metadata={
                "company": request.company,
                "role": request.role,
                "round_type": request.round_type,
                "source": source_prefix
            }
        )
        log_event("interview_paste", {"company": request.company, "source": source_prefix})
        return IngestResponse(
            filename=result["filename"],
            chunks_indexed=result["chunks_indexed"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/interview/research")
def research_interview(request: InterviewResearchRequest):
    """Use LLM to auto-research common interview patterns for a company and role."""
    try:
        from src.generation.groq_client import GroqClient
        llm = GroqClient()

        prompt = f"""You are an expert placement preparation advisor. Research and describe the typical interview process for the following:

Company: {request.company}
Role: {request.role}
Round Type: {request.round_type}

Provide a detailed, structured summary including:
1. Overview of the interview process (number of rounds, format)
2. Common technical questions asked (with difficulty level)
3. Coding/DSA topics frequently tested
4. Behavioral/HR questions to expect
5. Tips and preparation strategies
6. Recent trends or changes in the hiring process

Format the response as a clear, actionable guide that a student can use to prepare. Be specific with example questions where possible."""

        research_text = llm.generate(prompt)
        log_event("interview_research", {"company": request.company})
        return {"research_text": research_text, "company": request.company}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tutor/explain")
def route_tutor_explain(request: TutorRequest):
    """Explain concepts from lecture notes in various modes (streamed)."""
    try:
        log_event("tutor", {})
        return StreamingResponse(
            explain_concept_stream(request.topic, request.difficulty),
            media_type="text/event-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quiz/generate", response_model=QuizResponse)
def route_quiz_generate(request: QuizRequest):
    """Generate a structured quiz from the notes."""
    try:
        questions = generate_quiz(
            subject=request.subject,
            difficulty=request.difficulty,
            num_questions=request.num_questions,
            quiz_type=request.quiz_type,
            filename=request.filename
        )
        return QuizResponse(questions=questions)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Quiz could not be generated.")


@app.post("/flashcards/generate", response_model=FlashcardResponse)
def route_flashcards_generate(request: FlashcardRequest):
    """Generate study flashcards from the notes."""
    try:
        cards = generate_flashcards(request.subject, request.num_cards)
        log_event("flashcard_review", {})
        return FlashcardResponse(cards=cards)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Flashcards unavailable.")


@app.post("/study-plan/generate", response_model=StudyPlanResponse)
def route_study_plan_generate(request: StudyPlanRequest):
    """Generate a custom study plan, optionally grounding in target company data."""
    try:
        plan = generate_study_plan(
            exam_date=request.exam_date,
            subjects=request.subjects,
            daily_hours=request.daily_hours,
            weak_subjects=request.weak_subjects,
            target_company=request.target_company
        )
        return StudyPlanResponse(
            daily_plan=plan["daily_plan"],
            weekly_goals=plan["weekly_goals"],
            revision_schedule=plan["revision_schedule"],
            study_tips=plan["study_tips"],
            motivational_message=plan["motivational_message"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Study plan could not be created.")


@app.get("/api/analytics")
def get_analytics_api():
    """Retrieve compiled study and readiness analytics."""
    try:
        data = get_analytics_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analytics/log-quiz")
def log_quiz_completion_api(request: QuizLogRequest):
    """Log a completed quiz attempt for analytics tracking."""
    try:
        log_event("quiz_completed", {
            "subject": request.subject,
            "difficulty": request.difficulty,
            "score": request.score,
            "correct": request.correct,
            "wrong": request.wrong
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


