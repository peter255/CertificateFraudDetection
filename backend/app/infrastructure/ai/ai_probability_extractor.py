from __future__ import annotations

from typing import Any

_EXPLICIT_PROBABILITY_KEYS = frozenset(
    {
        "aiprobability",
        "aiprob",
        "aigenerationprobability",
        "aigeneratedprobability",
        "aigeneratedscore",
        "aigenerationscore",
        "ailikelihood",
        "aisyntheticprobability",
        "syntheticprobability",
        "deepfakeprobability",
        "generatedcontentconfidence",
        "aidetectionscore",
        "aidetectionprobability",
        "generativeaiprobability",
        "generativeprobability",
        "genaiprobability",
        "aigenerationlikelihood",
        "aigeneratedconfidence",
        "aidetectionsconfidence",
        "coreaaiscore",
    }
)

_EXCLUDED_SCORE_KEYS = frozenset(
    {
        "confidence",
        "modelconfidence",
        "model_confidence",
        "trustscore",
        "trust_score",
        "documenttrustscore",
        "document_trust_score",
        "riskscore",
        "risk_score",
        "fraudscore",
        "fraud_score",
        "fraudscore100",
        "score",
        "score100",
        "score_100",
        "rawscore",
        "raw_score",
        "ocrscore",
        "ocr_score",
        "mlscore",
        "ml_score",
        "fieldfitscore",
        "field_fit_score",
    }
)


def _normalize_key(key: str) -> str:
    return "".join(ch for ch in key.lower() if ch.isalnum())


def _to_score_100(raw: float | int | None) -> float | None:
    if raw is None:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if not (value >= 0):
        return None
    if value <= 1:
        return round(min(100.0, max(0.0, value * 100.0)), 1)
    return round(min(100.0, max(0.0, value)), 1)


def _is_ai_probability_key(key: str) -> bool:
    normalized = _normalize_key(key)
    if not normalized or normalized in _EXCLUDED_SCORE_KEYS:
        return False
    if normalized in _EXPLICIT_PROBABILITY_KEYS:
        return True

    has_ai_topic = (
        normalized.startswith("ai")
        or normalized.startswith("generative")
        or normalized.startswith("synthetic")
        or normalized.startswith("deepfake")
        or normalized.startswith("genai")
        or "aigenerat" in normalized
        or "generatedcontent" in normalized
    )
    has_score_sense = any(
        token in normalized
        for token in ("prob", "likelihood", "score", "confidence", "detection")
    )
    if not has_ai_topic or not has_score_sense:
        return False
    if normalized in {"aiscore", "aiscores"}:
        return False
    return True


def _walk_for_probability(node: Any, *, depth: int = 0, depth_limit: int = 5) -> float | None:
    if depth > depth_limit or node is None:
        return None

    if isinstance(node, list):
        for item in node:
            found = _walk_for_probability(item, depth=depth + 1, depth_limit=depth_limit)
            if found is not None:
                return found
        return None

    if not isinstance(node, dict):
        return None

    for key, value in node.items():
        if _is_ai_probability_key(str(key)) and isinstance(value, (int, float)):
            score = _to_score_100(value)
            if score is not None:
                return score

    for value in node.values():
        if isinstance(value, (dict, list)):
            found = _walk_for_probability(value, depth=depth + 1, depth_limit=depth_limit)
            if found is not None:
                return found

    return None


def extract_vendor_ai_probability(*payloads: dict[str, Any] | None) -> float | None:
    """Return the first explicit AI probability found in nested vendor payloads."""
    for payload in payloads:
        if not payload:
            continue
        found = _walk_for_probability(payload)
        if found is not None:
            return found
    return None
