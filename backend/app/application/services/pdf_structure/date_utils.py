from __future__ import annotations

import re
from datetime import datetime, timezone


_PDF_DATE_RE = re.compile(
    r"^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?"
    r"(?:([Zz])|([+\-])(\d{2})'?(\d{2})'?)?"
)


def parse_flexible_datetime(value: str | None) -> datetime | None:
    """Parse PDF, ISO, or common certificate date strings. Returns None if invalid."""
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None

    pdf_match = _PDF_DATE_RE.match(raw)
    if pdf_match:
        try:
            year = int(pdf_match.group(1))
            month = int(pdf_match.group(2) or 1)
            day = int(pdf_match.group(3) or 1)
            hour = int(pdf_match.group(4) or 0)
            minute = int(pdf_match.group(5) or 0)
            second = int(pdf_match.group(6) or 0)
            return datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)
        except ValueError:
            return None

    normalized = raw.replace("Z", "+00:00")
    for candidate in (normalized, raw):
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            pass

    for fmt in (
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%B %d, %Y",
        "%b %d, %Y",
        "%d %B %Y",
        "%d %b %Y",
    ):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    return None


def is_invalid_timestamp(value: str | None) -> bool:
    """True when a non-empty timestamp string cannot be parsed."""
    if value is None:
        return False
    raw = str(value).strip()
    if not raw:
        return False
    return parse_flexible_datetime(raw) is None
