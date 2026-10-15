# Placement Prep RAG Assistant

RAG application for tech placement preparation — answers grounded in your own uploaded notes, resumes, and interview experiences.

## Phase 1 Status: Core Pipeline

Implemented: ingest → chunk → embed → ChromaDB → retrieve → Groq generation with citations.

Not yet built: Streamlit UI, feature modules (Notes Q&A, Interview prep, etc.).

## Architecture

```
Upload (PDF/TXT)
      │
      ▼
  loader.py ──► page-level text + filename
      │
      ▼
  chunker.py ──► ~800-word chunks, ~15% overlap
      │
      ▼
  embedder.py ──► all-MiniLM-L6-v2 (local)
      │
      ▼
  chroma_client.py ──► persistent ./chroma_db (per-module collections)
      │
      ▼
  retriever.py ──► top-k similarity + citation formatting
      │
      ▼
  groq_client.py ──► llama-3.3-70b-versatile answer + sources
```

## Folder Structure

```
placement-prep-rag/
├── config/settings.py
├── data/raw/{notes,interview_experiences,resumes}/
├── chroma_db/                    # auto-created
├── src/
│   ├── ingestion/   loader, chunker, pipeline, resume_parser (stub)
│   ├── embeddings/  embedder
│   ├── vectorstore/ chroma_client
│   ├── retrieval/   retriever
│   ├── generation/  llm_interface, groq_client
│   ├── modules/     stubs for Phases 2–5
│   └── api/         FastAPI health check
├── frontend/        Streamlit stub (Phase 6)
├── eval/            precision@k evaluation
└── notebooks/       pipeline test notebook
```

## Setup

**Python 3.11 recommended** (3.14 lacks prebuilt wheels for some deps like ChromaDB).

```bash
cd placement-prep-rag
py -3.11 -m venv .venv

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
copy .env.example .env
# Edit .env and set GROQ_API_KEY=...
```

## Phase 1 Test

**Option A — sample TXT (included):**

```bash
python scripts/test_phase1.py
```

**Option B — your PDF:**

```bash
# Copy PDF to data/raw/notes/
python scripts/test_phase1.py data/raw/notes/your_notes.pdf
```

**Option C — Jupyter notebook:**

```bash
jupyter notebook notebooks/01_pipeline_test.ipynb
```

Without `GROQ_API_KEY`, the test still runs ingest + retrieval; generation is skipped.

## Modules (planned)

| Module | File | Phase | Status |
|--------|------|-------|--------|
| Core RAG pipeline | `src/ingestion/pipeline.py` | 1 | Done |
| Notes Q&A | `src/modules/subject_qa.py` | 2 | Pending |
| Interview prep | `src/modules/interview_qa.py` | 3 | Pending |
| Resume mapper | `src/modules/resume_mapper.py` | 4 | Pending |
| Assignment help | `src/modules/assignment_helper.py` | 5 | Pending |
| Streamlit UI | `frontend/app.py` | 6 | Pending |

## Evaluation

After ingesting documents:

```bash
python eval/evaluate.py
```

Computes mean precision@k using keyword overlap against `eval/test_questions.json`.

## Design Notes

- **Separate Chroma collections** per module prevent notes from polluting interview retrieval.
- **LLMInterface** abstracts Groq so the provider can be swapped without changing business logic.
- **Word-based chunking** approximates 800 tokens without adding tiktoken as a dependency.
- **Page numbers from pdfplumber** enable `filename.pdf, p.N` citations in answers.
.venv\Scripts\python.exe -m uvicorn src.api.main:app --reload
cd "C:\Users\palla\Desktop\rag project\placement-prep-rag"