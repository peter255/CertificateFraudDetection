from __future__ import annotations


def excerpt(value: str | None, limit: int) -> str | None:
    """Return a trimmed string truncated to `limit` characters (ellipsis when cut)."""
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    if len(text) <= limit:
        return text
    if limit <= 1:
        return "…"
    return text[: limit - 1] + "…"
