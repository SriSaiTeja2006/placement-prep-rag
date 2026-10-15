"""Groq API implementation of LLMInterface."""

from __future__ import annotations

from groq import Groq

from config.settings import GROQ_API_KEY, GROQ_MODEL
from src.generation.llm_interface import LLMInterface


class GroqClient(LLMInterface):
    """
    Groq-backed LLM using llama-3.3-70b-versatile.

    Wrapped behind LLMInterface so we can swap to OpenAI/Ollama later
    by changing only this file and config.
    """

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        key = api_key or GROQ_API_KEY
        if not key:
            raise ValueError(
                "GROQ_API_KEY is not set. Add it to placement-prep-rag/.env "
                "(see .env.example)."
            )
        self.model = model or GROQ_MODEL
        self._client = Groq(api_key=key)

    def generate(self, prompt: str) -> str:
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=4096,
            )
            content = response.choices[0].message.content
            return content.strip() if content else ""
        except Exception as exc:
            error_msg = str(exc).lower()
            if "rate" in error_msg or "429" in error_msg:
                raise RuntimeError(
                    "Groq rate limit reached. Please wait a moment and try again."
                ) from exc
            if "403" in error_msg or "permission" in error_msg or "blocked" in error_msg:
                raise RuntimeError(
                    f"Groq model access denied for '{self.model}'. "
                    "Enable the model at https://console.groq.com/settings/limits "
                    "or update GROQ_MODEL in .env."
                ) from exc
            raise RuntimeError(f"Groq API error: {exc}") from exc

    def generate_stream(self, prompt: str):
        try:
            stream = self._client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=4096,
                stream=True
            )
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
        except Exception as exc:
            error_msg = str(exc).lower()
            if "rate" in error_msg or "429" in error_msg:
                yield "Error: Groq rate limit reached. Please wait a moment."
            elif "403" in error_msg or "permission" in error_msg or "blocked" in error_msg:
                yield f"Error: Groq model access denied for '{self.model}'."
            else:
                yield f"Error: Groq API error: {exc}"
