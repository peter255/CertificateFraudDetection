from __future__ import annotations

import json
import re
from typing import Any

from app.application.dto.pdf_structure import PdfStructureFinding

_VALID_SEVERITIES = frozenset({"info", "warning", "critical"})
_VALID_STATUSES = frozenset({"pass", "warning", "fail"})


def parse_logical_consistency_response(
    raw: str | None,
) -> tuple[list[PdfStructureFinding], str | None]:
    if not raw or not raw.strip():
        return [], None

    data = extract_json_object(raw)
    if not isinstance(data, dict):
        return [], None

    findings: list[PdfStructureFinding] = []
    findings_raw = data.get("findings")
    if isinstance(findings_raw, list):
        for item in findings_raw:
            parsed = coerce_finding(item)
            if parsed is not None:
                findings.append(parsed)

    summary = data.get("summary")
    summary_text = summary.strip() if isinstance(summary, str) and summary.strip() else None
    return findings, summary_text


def parse_summary_response(raw: str | None) -> str | None:
    if not raw or not raw.strip():
        return None
    data = extract_json_object(raw)
    if isinstance(data, dict):
        summary = data.get("summary")
        if isinstance(summary, str) and summary.strip():
            return summary.strip()
    cleaned = raw.strip()
    return cleaned or None


def extract_json_object(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned, flags=re.IGNORECASE)
    if fence:
        cleaned = fence.group(1).strip()

    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(cleaned[start : end + 1])
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def coerce_finding(item: Any) -> PdfStructureFinding | None:
    if not isinstance(item, dict):
        return None

    title = item.get("title")
    description = item.get("description")
    if not isinstance(title, str) or not title.strip():
        return None
    if not isinstance(description, str) or not description.strip():
        return None

    severity = str(item.get("severity") or "warning").strip().lower()
    if severity not in _VALID_SEVERITIES:
        severity = "warning"

    status = str(item.get("status") or "warning").strip().lower()
    if status not in _VALID_STATUSES:
        status = "warning"

    rule_id = item.get("rule_id")
    if not isinstance(rule_id, str) or not rule_id.strip():
        rule_id = "LLM_LOGICAL_CONSISTENCY"
    elif not rule_id.upper().startswith("LLM_"):
        rule_id = f"LLM_{rule_id.strip()}"

    evidence = item.get("evidence")
    if not isinstance(evidence, dict):
        evidence = {"raw": evidence} if evidence is not None else {}

    recommendation = item.get("recommendation")
    recommendation_text = recommendation.strip() if isinstance(recommendation, str) else ""

    confidence_raw = item.get("confidence", 0.7)
    try:
        confidence = float(confidence_raw)
    except (TypeError, ValueError):
        confidence = 0.7
    if confidence > 1.0:
        confidence = confidence / 100.0
    confidence = max(0.0, min(1.0, confidence))

    return PdfStructureFinding(
        rule_id=rule_id.strip(),
        severity=severity,
        status=status,
        title=title.strip(),
        description=description.strip(),
        evidence=evidence,
        recommendation=recommendation_text,
        confidence=confidence,
    )
