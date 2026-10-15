"""Abstract LLM interface — swap providers without touching business logic."""

from __future__ import annotations

from abc import ABC, abstractmethod


class LLMInterface(ABC):
    """Contract for text generation backends (Groq today, others later)."""

    @abstractmethod
    def generate(self, prompt: str) -> str:
        """Generate a text completion for the given prompt."""
        raise NotImplementedError

    @abstractmethod
    def generate_stream(self, prompt: str):
        """Generate a text completion as a stream of chunks."""
        raise NotImplementedError
