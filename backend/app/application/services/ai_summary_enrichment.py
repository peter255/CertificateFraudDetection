from __future__ import annotations

import re
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

    async def enrich_text_manipulation(
        self,
        *,
        signals: list[dict[str, Any]],
        field_evidence: list[dict[str, Any]] | None = None,
        context: dict[str, Any] | None = None,
    ) -> str | None:
        """Summarize Text Manipulation signals for a non-technical user via Azure OpenAI."""
        combined = [*(signals or []), *(field_evidence or [])]
        text_findings = [
            _normalize_finding(item)
            for item in combined
            if isinstance(item, dict) and _bucket_for_signal(item) == "text"
        ]
        text_findings = [
            item
            for item in text_findings
            if item.get("description") or item.get("check") or item.get("field") or item.get("field_label")
        ]
        if not text_findings:
            logger.info("Text manipulation summary skipped — no text-bucket findings.")
            return None

        logger.info("Text manipulation summary: %s finding(s)", len(text_findings))

        if self._ai_client.is_configured():
            try:
                generated = await self._ai_client.generate_category_summary(
                    category="Text Manipulation",
                    findings=text_findings,
                    context=context or {},
                )
                if generated and not looks_like_recommendation(generated):
                    return generated
                logger.warning("Azure text-manipulation summary missing/invalid; using fallback.")
            except Exception as exc:  # noqa: BLE001
                logger.warning("Azure OpenAI text-manipulation summary failed: %s", exc)

        return _build_category_fallback("Text manipulation", text_findings)

    async def enrich_image_manipulation(
        self,
        *,
        signals: list[dict[str, Any]],
        visual_evidence: list[dict[str, Any]] | None = None,
        context: dict[str, Any] | None = None,
    ) -> str | None:
        """Summarize Image Manipulation signals/evidence for a non-technical user via Azure OpenAI."""
        combined = [*(signals or []), *(visual_evidence or [])]
        image_findings = [
            _normalize_finding(item)
            for item in combined
            if isinstance(item, dict) and _bucket_for_signal(item) == "image"
        ]
        for item in visual_evidence or []:
            if not isinstance(item, dict) or not item:
                continue
            normalized = _normalize_finding(item)
            if _bucket_for_signal(normalized) == "pdf":
                continue
            if normalized not in image_findings:
                image_findings.append(normalized)

        image_findings = [
            item
            for item in image_findings
            if item.get("description") or item.get("title") or item.get("check") or item.get("type")
        ]
        if not image_findings:
            return None

        if self._ai_client.is_configured():
            try:
                generated = await self._ai_client.generate_category_summary(
                    category="Image Manipulation",
                    findings=image_findings,
                    context=context or {},
                )
                if generated and not looks_like_recommendation(generated):
                    return generated
            except Exception as exc:  # noqa: BLE001
                logger.warning("Azure OpenAI image-manipulation summary failed: %s", exc)

        return _build_category_fallback("Image manipulation", image_findings)


def _signal_haystack(item: dict[str, Any]) -> str:
    return " ".join(
        str(item.get(key) or "")
        for key in (
            "category",
            "layer",
            "check",
            "detector",
            "detector_label",
            "description",
            "evidence_class",
            "fraud_type",
            "field",
            "field_label",
            "title",
            "type",
            "location",
            "stage",
            "engine",
        )
    ).lower()


def _bucket_for_signal(item: dict[str, Any]) -> str:
    """Match frontend ResultsDashboard bucketing: pdf → image → text (default)."""
    hay = _signal_haystack(item)
    if not hay.strip():
        return "text"
    if re.search(
        r"\bpdf\b|xmp|incremental|embedded.?font|structure|metadata|provenance|c2pa",
        hay,
    ):
        return "pdf"
    if re.search(
        r"\bimage\b|visual|copy.?move|splic|resampl|seal|pixel|heatmap|perceptual|forensic",
        hay,
    ):
        # Field/OCR/text cues stay in Text even when a weak "forensic" label is present.
        if re.search(
            r"\b(?:ocr|font|text|typography|glyph|field.?valid|holder|issuer|name.?field|date.?field)\b",
            hay,
        ):
            return "text"
        return "image"
    return "text"


def _normalize_finding(item: dict[str, Any]) -> dict[str, Any]:
    out = dict(item)
    if not out.get("description"):
        bits = [
            out.get("title"),
            out.get("check"),
            out.get("detector_label") or out.get("detector"),
            out.get("field_label") or out.get("field"),
            out.get("fraud_type") or out.get("type"),
        ]
        desc = " — ".join(str(b).strip() for b in bits if isinstance(b, str) and b.strip())
        if desc:
            out["description"] = desc
    return out


def _build_category_fallback(label: str, findings: list[dict[str, Any]]) -> str:
    bits: list[str] = []
    for item in findings[:3]:
        desc = (
            item.get("description")
            or item.get("title")
            or item.get("check")
            or item.get("field_label")
            or item.get("fraud_type")
            or item.get("type")
        )
        if isinstance(desc, str) and desc.strip() and not looks_like_recommendation(desc):
            # Keep each bullet short.
            short = re.sub(r"\s+", " ", desc.strip())
            if len(short) > 90:
                short = short[:89].rstrip(" ,;") + "…"
            bits.append(short)
    if not bits:
        return f"No clear {label.lower()} issues stood out in this scan."
    if len(bits) == 1:
        return f"{bits[0]}"
    lead = f"{label} shows {len(bits)} key issues."
    detail = " ".join(f"{bit}." if not bit.endswith((".", "!", "?", "…")) else bit for bit in bits[:2])
    return f"{lead} {detail}"


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
        top = unique_flags[:3]
        listed = ", ".join(top)
        extra = f" (+{len(unique_flags) - 3} more)" if len(unique_flags) > 3 else ""
        return (
            f"Result: {verdict_label}. "
            f"Main flags: {listed}{extra}."
        )

    return (
        f"Result: {verdict_label}. "
        "No suspicious forensic indicators of manipulation stood out in this scan."
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
