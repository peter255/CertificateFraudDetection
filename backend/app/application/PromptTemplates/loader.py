from __future__ import annotations

from functools import lru_cache
from pathlib import Path


class PromptTemplateLoader:
    """
    Load prompt template files from the PromptTemplates package directory.

    Templates use `{placeholder}` substitution. Business services must not embed
    prompt prose — they only supply placeholder values.
    """

    def __init__(self, templates_root: Path | None = None) -> None:
        self._root = (templates_root or Path(__file__).resolve().parent).resolve()

    @property
    def root(self) -> Path:
        return self._root

    def load(self, relative_path: str) -> str:
        """Load a template by path relative to the PromptTemplates root."""
        return _load_template(str(self._root), relative_path)

    def render(self, relative_path: str, **placeholders: str) -> str:
        """Load a template and substitute `{name}` placeholders."""
        template = self.load(relative_path)
        try:
            return template.format(**placeholders)
        except KeyError as exc:
            missing = exc.args[0] if exc.args else "?"
            raise ValueError(
                f"Prompt template '{relative_path}' missing placeholder value for {{{missing}}}"
            ) from exc


@lru_cache(maxsize=32)
def _load_template(root_str: str, relative_path: str) -> str:
    root = Path(root_str)
    # Reject absolute / parent-traversal paths before resolve.
    candidate = Path(relative_path)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise ValueError(f"Prompt template path escapes templates root: {relative_path}")

    path = (root / candidate).resolve()
    if not path.is_relative_to(root):
        raise ValueError(f"Prompt template path escapes templates root: {relative_path}")
    if not path.is_file():
        raise FileNotFoundError(f"Prompt template not found: {path}")
    return path.read_text(encoding="utf-8")
