"""Load PDF and plain-text files while preserving page numbers for citations."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pdfplumber
import zipfile
import xml.etree.ElementTree as ET


@dataclass
class PageText:
    """Text from a single page (or logical page for TXT files)."""

    text: str
    page_number: int
    filename: str


SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".docx"}


def load_file(file_path: str | Path) -> list[PageText]:
    """
    Load a PDF, TXT, or DOCX file into page-level segments.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    suffix = path.suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{suffix}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    if suffix == ".pdf":
        return _load_pdf(path)
    elif suffix == ".docx":
        return _load_docx(path)
    return _load_txt(path)


def _load_docx(path: Path) -> list[PageText]:
    try:
        texts = []
        with zipfile.ZipFile(path) as docx:
            xml_content = docx.read('word/document.xml')
            root = ET.fromstring(xml_content)
            # Find all paragraph elements (w:p)
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            for para in root.findall('.//w:p', ns):
                text_runs = []
                for run in para.findall('.//w:t', ns):
                    if run.text:
                        text_runs.append(run.text)
                if text_runs:
                    texts.append("".join(text_runs))
        
        full_text = "\n".join(texts).strip()
        if not full_text:
            raise ValueError("No text extracted from Word document.")
            
        return [PageText(text=full_text, page_number=1, filename=path.name)]
    except Exception as exc:
         raise ValueError(f"Failed to parse DOCX '{path.name}': {exc}") from exc


def _load_pdf(path: Path) -> list[PageText]:
    pages: list[PageText] = []
    try:
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append(PageText(text=text.strip(), page_number=i, filename=path.name))
    except Exception as exc:
        raise ValueError(f"Failed to parse PDF '{path.name}': {exc}") from exc

    if not pages:
        raise ValueError(f"No extractable text found in PDF '{path.name}'")
    return pages


def _load_txt(path: Path) -> list[PageText]:
    try:
        text = path.read_text(encoding="utf-8").strip()
    except UnicodeDecodeError:
        text = path.read_text(encoding="latin-1").strip()

    if not text:
        raise ValueError(f"File '{path.name}' is empty")
    return [PageText(text=text, page_number=1, filename=path.name)]
