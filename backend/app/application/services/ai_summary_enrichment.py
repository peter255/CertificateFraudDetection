from __future__ import annotations

from typing import Any

from app.application.interfaces.ai_analysis_port import IAiAnalysisPort
from app.shared.logging.logger import get_logger

logger = get_logger(__name__)

_RECOMMENDATION_MARKERS = (
    "manual review",
    "recommend",
    "approve",
    "reject",
    "next step",
    "suggested action",
    "should be reviewed",
    "requires review",
    "review is required",
    "review-level",
    "automatic reject",
)


class AiSummaryEnrichmentService:
    """
    Build an executive summary via Azure OpenAI, with a flags-only fallback.

    The summary must describe detected flags / forensic signals only.
    It must not include approve / reject / manual-review recommendations.
    """

    def __init__(self, ai_client: IAiAnalysisPort) -> None:
        self._ai_client = ai_client

    async def enrich(self, *, context: dict[str, Any]) -> str:
        summary_context = _summary_context(context)

        if self._ai_client.is_configured():
            try:
                generated = await self._ai_client.generate_summary(context=summary_context)
                if generated and not looks_like_recommendation(generated):
                    return generated
            except Exception as exc:  # noqa: BLE001 — optional enrichment must not fail verify
                logger.warning("Azure OpenAI summary generation failed: %s", exc)

        return build_flags_summary(summary_context)


def looks_like_recommendation(text: str | None) -> bool:
    if not text or not text.strip():
        return False
    lowered = text.lower()
    return any(marker in lowered for marker in _RECOMMENDATION_MARKERS)


def build_flags_summary(context: dict[str, Any]) -> str:
    """Deterministic flags narrative used when Azure is unavailable or returns junk."""
    verdict = (
        context.get("verdict")
        or context.get("overall_status")
        or context.get("final_result")
        or "unknown"
    )
    verdict_label = str(verdict).replace("_", " ").strip()

    flags = list(context.get("detected_flags") or [])
    if not flags:
        flags = _collect_flags(context)

    # Deduplicate while preserving order.
    seen: set[str] = set()
    unique_flags: list[str] = []
    for flag in flags:
        key = str(flag).strip()
        if not key:
            continue
        lowered = key.lower()
        if lowered in seen or looks_like_recommendation(key):
            continue
        seen.add(lowered)
        unique_flags.append(key)

    if unique_flags:
        listed = "; ".join(unique_flags)
        return (
            f"Verification classified this document as {verdict_label}. "
            f"Detected flags: {listed}."
        )

    return (
        f"Verification classified this document as {verdict_label}. "
        "No discrete fraud flags were reported in the available forensic signals."
    )


def _summary_context(context: dict[str, Any]) -> dict[str, Any]:
    """Keep flag-oriented fields only — never pass recommendation text to the model."""
    slim: dict[str, Any] = {}

    for key in (
        "engine",
        "verdict",
        "overall_status",
        "final_result",
        "fraud_types",
        "fraud_score",
        "risk_level",
        "ml_label",
        "ml_score",
        "ocr_label",
        "ocr_score",
        "key_indicators",
        "visual_patterns",
        "metadata_notes",
        "reasoning",
        "raw_score",
    ):
        value = context.get(key)
        if value not in (None, "", [], {}):
            # Drop recommendation-like reasoning so it cannot leak into prompts/fallbacks.
            if key == "reasoning" and isinstance(value, str) and looks_like_recommendation(value):
                continue
            slim[key] = value

    flags = _collect_flags(context)
    if flags:
        slim["detected_flags"] = flags

    signals = context.get("signals")
    if isinstance(signals, list) and signals:
        slim["signals"] = [
            {
                k: item.get(k)
                for k in ("category", "description", "status", "severity", "title")
                if isinstance(item, dict) and item.get(k) not in (None, "")
            }
            for item in signals[:16]
            if isinstance(item, dict)
        ]

    layer_details = context.get("layer_details")
    if isinstance(layer_details, dict):
        llm_report = layer_details.get("llm_report")
        if isinstance(llm_report, dict):
            report_bits: dict[str, Any] = {}
            for key in ("detailed_findings", "risk_factors", "tamper_method", "ai_generated"):
                value = llm_report.get(key)
                if value in (None, "", [], {}):
                    continue
                if isinstance(value, str) and looks_like_recommendation(value):
                    continue
                report_bits[key] = value
            if report_bits:
                slim["llm_findings"] = report_bits

            for factor in _as_str_list(llm_report.get("risk_factors")):
                if factor not in flags and not looks_like_recommendation(factor):
                    flags.append(factor)
            if flags:
                slim["detected_flags"] = flags

        c2pa = layer_details.get("c2pa")
        if isinstance(c2pa, dict):
            meta = c2pa.get("metadata") if isinstance(c2pa.get("metadata"), dict) else c2pa
            if isinstance(meta, dict):
                provenance = {
                    k: meta.get(k)
                    for k in ("ai_generated", "ai_indicators", "generator", "has_c2pa")
                    if meta.get(k) is not None
                }
                if provenance:
                    slim["provenance"] = provenance

    return slim


def _collect_flags(context: dict[str, Any]) -> list[str]:
    flags: list[str] = []
    for key in ("fraud_types", "key_indicators", "visual_patterns", "metadata_notes"):
        for item in _as_str_list(context.get(key)):
            if item not in flags and not looks_like_recommendation(item):
                flags.append(item)

    signals = context.get("signals")
    if isinstance(signals, list):
        for item in signals:
            if not isinstance(item, dict):
                continue
            desc = item.get("description") or item.get("title")
            if (
                isinstance(desc, str)
                and desc.strip()
                and desc.strip() not in flags
                and not looks_like_recommendation(desc)
            ):
                flags.append(desc.strip())

    return flags


def _as_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out
