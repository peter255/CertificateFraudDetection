from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.application.dto.pdf_structure import PdfStructureAnalyzeResponse
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
    "further investigation",
    "further forensic",
    "additional analysis",
)

NO_LOCALIZED_VISUAL_EVIDENCE = (
    "No localized visual evidence of document manipulation was identified."
)

_UNWANTED_SENTENCE_MARKERS = (
    "not a native pdf",
    "not a pdf",
    "png image, not",
    "jpeg image, not",
    "jpg image, not",
    "is a png image",
    "is a jpeg image",
    "is an image, not",
    "file is a png",
    "file is a jpeg",
    "because the file is a png",
    "because the file is a jpeg",
    "because the file is an image",
    "raster image, not",
    "information is incomplete",
    "metadata is incomplete",
    "analysis is incomplete",
    "data is incomplete",
    "incomplete metadata",
    "incomplete information",
    "limited metadata",
    "metadata extraction was skipped",
    "unsupported format",
    "no pdf metadata was available",
    "not available for cross-check",
    "not available for comparison",
    "could not be compared",
    "analysis metadata was not available",
)

_FORMAT_NOISE_KEYS = frozenset({"parse_error", "is_pdf"})


@dataclass(frozen=True)
class DisplayAnalysisResult:
    """Azure-authored dashboard scores + short narratives (optional fields)."""

    risk_score: int | None = None
    fraud_probability: int | None = None
    text_logic_score: int | None = None
    image_forensics_score: int | None = None
    file_structure_score: int | None = None
    executive_summary: str | None = None
    text_manipulation_summary: str | None = None
    image_manipulation_summary: str | None = None
    pdf_structure_summary: str | None = None

    def as_response_updates(self) -> dict[str, Any]:
        """Map to API response field names (omit None). Narrative key is caller-specific."""
        mapping = {
            "display_risk_score": self.risk_score,
            "fraud_probability": self.fraud_probability,
            "text_logic_score": self.text_logic_score,
            "image_forensics_score": self.image_forensics_score,
            "file_structure_score": self.file_structure_score,
            "text_manipulation_summary": self.text_manipulation_summary,
            "image_manipulation_summary": self.image_manipulation_summary,
            "pdf_structure_summary": self.pdf_structure_summary,
        }
        return {key: value for key, value in mapping.items() if value is not None}


class AiSummaryEnrichmentService:
    """
    Build an executive summary via Azure OpenAI, with a flags-only fallback.

    The summary must describe detected flags / forensic signals only.
    It must not include approve / reject / manual-review recommendations.
    """

    def __init__(self, ai_client: IAiAnalysisPort) -> None:
        self._ai_client = ai_client

    async def enrich(self, *, context: dict[str, Any], use_llm: bool = True) -> str:
        summary_context = _summary_context(context)

        # Prefer a clean vendor narrative when present (instant — no Azure round-trip).
        vendor_summary = context.get("executive_summary") or context.get("vendor_executive_summary")
        if isinstance(vendor_summary, str) and vendor_summary.strip():
            cleaned = vendor_summary.strip()
            if not looks_like_recommendation(cleaned):
                sanitized = sanitize_narrative_text(cleaned)
                if sanitized:
                    return sanitized

        if use_llm and self._ai_client.is_configured():
            try:
                generated = await self._ai_client.generate_summary(context=summary_context)
                if generated and not looks_like_recommendation(generated):
                    cleaned = sanitize_narrative_text(generated)
                    if cleaned:
                        return cleaned
            except Exception as exc:  # noqa: BLE001 — optional enrichment must not fail verify
                logger.warning("Azure OpenAI summary generation failed: %s", exc)

        return sanitize_narrative_text(build_flags_summary(summary_context)) or build_flags_summary(
            summary_context
        )

    async def cross_check_summary(
        self,
        *,
        vendor_context: dict[str, Any],
        pdf_analysis: PdfStructureAnalyzeResponse,
    ) -> str | None:
        """
        Compare vendor identity/signals with PDF Structure / DI OCR and return
        a short narrative. Falls back to the pipeline's own summary when Azure
        is unavailable or fails.
        """
        pdf_structure_context = _pdf_structure_prompt_context(pdf_analysis)
        fallback = pdf_analysis.summary

        if self._ai_client.is_configured():
            try:
                generated = await self._ai_client.generate_cross_check_summary(
                    vendor_context=vendor_context,
                    pdf_structure_context=pdf_structure_context,
                )
                if generated and not looks_like_recommendation(generated):
                    cleaned = sanitize_narrative_text(generated)
                    if cleaned:
                        return cleaned
                logger.warning("Azure cross-check summary missing/invalid; using PDF Structure fallback.")
            except Exception as exc:  # noqa: BLE001 — optional enrichment must not fail verify
                logger.warning("Azure OpenAI vendor/structure cross-check failed: %s", exc)

        return sanitize_narrative_text(fallback) or fallback

    async def enrich_text_manipulation(
        self,
        *,
        signals: list[dict[str, Any]],
        field_evidence: list[dict[str, Any]] | None = None,
        context: dict[str, Any] | None = None,
        use_llm: bool = True,
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

        if use_llm and self._ai_client.is_configured():
            try:
                generated = await self._ai_client.generate_category_summary(
                    category="Text Manipulation",
                    findings=text_findings,
                    context=context or {},
                )
                if generated and not looks_like_recommendation(generated):
                    cleaned = sanitize_narrative_text(generated)
                    if cleaned:
                        return cleaned
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
        use_llm: bool = True,
    ) -> str | None:
        """Summarize Image Manipulation using localized visual evidence only."""
        localized = [
            _normalize_finding(item)
            for item in (visual_evidence or [])
            if isinstance(item, dict) and _is_localized_visual_evidence(item)
        ]

        # Detailed Findings narrative may only cite highlightable regions.
        if not localized:
            return NO_LOCALIZED_VISUAL_EVIDENCE

        image_findings = localized[:24]
        ctx = dict(context or {})
        ctx["has_localized_visual_evidence"] = True
        ctx["localized_visual_count"] = len(localized)

        if use_llm and self._ai_client.is_configured():
            try:
                generated = await self._ai_client.generate_category_summary(
                    category="Image Manipulation",
                    findings=image_findings,
                    context=ctx,
                )
                if generated and not looks_like_recommendation(generated):
                    cleaned = sanitize_narrative_text(generated)
                    if cleaned:
                        return cleaned
            except Exception as exc:  # noqa: BLE001
                logger.warning("Azure OpenAI image-manipulation summary failed: %s", exc)

        return _build_category_fallback("Image manipulation", image_findings)

    async def enrich_display_analysis(
        self,
        *,
        context: dict[str, Any],
        signals: list[dict[str, Any]] | None = None,
        field_evidence: list[dict[str, Any]] | None = None,
        visual_evidence: list[dict[str, Any]] | None = None,
        use_llm: bool = True,
    ) -> DisplayAnalysisResult:
        """
        Ask Azure OpenAI for dashboard scores + short summaries.

        Falls back to local short narratives when Azure is unavailable. Scores are
        left None on fallback so the frontend can use its deterministic formulas.
        """
        summary_context = _summary_context(context)
        has_localized = bool(summary_context.get("has_localized_visual_evidence"))

        azure: dict[str, Any] | None = None
        if use_llm and self._ai_client.is_configured():
            try:
                azure = await self._ai_client.generate_display_analysis(context=summary_context)
            except Exception as exc:  # noqa: BLE001 — optional enrichment must not fail verify
                logger.warning("Azure OpenAI display analysis failed: %s", exc)
                azure = None

        if azure:
            image_summary = azure.get("image_manipulation_summary")
            image_score = azure.get("image_forensics_score")
            if not has_localized:
                image_summary = NO_LOCALIZED_VISUAL_EVIDENCE
                image_score = 0

            executive = azure.get("executive_summary")
            if isinstance(executive, str) and looks_like_recommendation(executive):
                executive = None

            return DisplayAnalysisResult(
                risk_score=azure.get("risk_score") if isinstance(azure.get("risk_score"), int) else None,
                fraud_probability=(
                    azure.get("fraud_probability")
                    if isinstance(azure.get("fraud_probability"), int)
                    else None
                ),
                text_logic_score=(
                    azure.get("text_logic_score")
                    if isinstance(azure.get("text_logic_score"), int)
                    else None
                ),
                image_forensics_score=image_score if isinstance(image_score, int) else None,
                file_structure_score=(
                    azure.get("file_structure_score")
                    if isinstance(azure.get("file_structure_score"), int)
                    else None
                ),
                executive_summary=executive if isinstance(executive, str) else None,
                text_manipulation_summary=_clean_optional_summary(
                    azure.get("text_manipulation_summary")
                ),
                image_manipulation_summary=_clean_optional_summary(image_summary),
                pdf_structure_summary=_clean_optional_summary(
                    azure.get("pdf_structure_summary")
                ),
            )

        # Local fallbacks — short summaries only; scores stay None (FE computes).
        executive = None
        vendor_summary = context.get("executive_summary") or context.get("vendor_executive_summary")
        if isinstance(vendor_summary, str) and vendor_summary.strip():
            cleaned = vendor_summary.strip()
            if not looks_like_recommendation(cleaned):
                executive = _clean_optional_summary(cleaned)
        if not executive:
            executive = _clean_optional_summary(build_flags_summary(summary_context))

        text_summary = await self.enrich_text_manipulation(
            signals=signals or [],
            field_evidence=field_evidence,
            context=summary_context,
            use_llm=False,
        )
        image_summary = await self.enrich_image_manipulation(
            signals=signals or [],
            visual_evidence=visual_evidence,
            context=summary_context,
            use_llm=False,
        )
        pdf_summary = context.get("pdf_structure_summary")
        if isinstance(pdf_summary, str) and pdf_summary.strip():
            pdf_summary = _clean_optional_summary(pdf_summary.strip())
        else:
            pdf_summary = None

        return DisplayAnalysisResult(
            executive_summary=executive,
            text_manipulation_summary=_clean_optional_summary(text_summary) if text_summary else None,
            image_manipulation_summary=image_summary,
            pdf_structure_summary=pdf_summary,
        )


def _clean_optional_summary(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    if looks_like_recommendation(value):
        return None
    shortened = _shorten_local_summary(value.strip())
    return sanitize_narrative_text(shortened) if shortened else None


def _shorten_local_summary(text: str | None) -> str | None:
    if not text or not text.strip():
        return None
    cleaned = re.sub(r"\s+", " ", text.strip())
    parts = re.split(r"(?<=[.!?])\s+", cleaned)
    sentences = [p.strip() for p in parts if p.strip()]
    if len(sentences) > 2:
        cleaned = " ".join(sentences[:2])
        if cleaned[-1] not in ".!?":
            cleaned += "."
    if len(cleaned) > 280:
        cut = cleaned[:279].rstrip(" ,;")
        cleaned = cut + ("." if cut[-1:] not in ".!?" else "")
    return cleaned


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


def _is_localized_visual_evidence(item: dict[str, Any]) -> bool:
    """True when an item can be highlighted on the document (page + bbox)."""
    page = item.get("page", item.get("page_number"))
    try:
        page_num = int(page) if page is not None else 0
    except (TypeError, ValueError):
        return False
    if page_num < 1:
        return False

    bbox = item.get("bbox") or item.get("bounding_box") or item.get("box")
    if not isinstance(bbox, (list, tuple)) or len(bbox) < 4:
        return False
    try:
        coords = [float(v) for v in bbox[:4]]
    except (TypeError, ValueError):
        return False
    return any(abs(v) > 0 for v in coords)


def _verdict_is_clean(context: dict[str, Any]) -> bool:
    verdict = str(
        context.get("verdict")
        or context.get("overall_status")
        or context.get("final_result")
        or ""
    ).strip().lower()
    return verdict in {
        "clean",
        "authentic",
        "pass",
        "passed",
        "genuine",
        "legitimate",
        "low_risk",
    }


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
        return f"No verified {label.lower()} forensic indicators were identified in this examination."
    if len(bits) == 1:
        return f"{bits[0]}"
    lead = f"{label} examination identified {len(bits)} material indicators."
    detail = " ".join(f"{bit}." if not bit.endswith((".", "!", "?", "…")) else bit for bit in bits[:2])
    return f"{lead} {detail}"


def looks_like_recommendation(text: str | None) -> bool:
    if not text or not text.strip():
        return False
    lowered = text.lower()
    return any(marker in lowered for marker in _RECOMMENDATION_MARKERS)


def _is_format_noise(text: str) -> bool:
    lowered = text.lower()
    return any(
        phrase in lowered
        for phrase in (
            "unsupported format",
            "not a native pdf",
            "not a pdf",
            "incomplete",
            "extraction skipped",
            "metadata extraction failed",
        )
    )


def _sanitize_file_context(payload: Any) -> Any:
    """Remove format-apology fields before they reach narrative prompts."""
    if not isinstance(payload, dict):
        return payload

    cleaned = dict(payload)
    for key in _FORMAT_NOISE_KEYS:
        cleaned.pop(key, None)

    props = cleaned.get("document_properties")
    if isinstance(props, dict):
        props_clean = {
            key: value
            for key, value in props.items()
            if key != "note" or not _is_format_noise(str(value))
        }
        if props_clean:
            cleaned["document_properties"] = props_clean
        else:
            cleaned.pop("document_properties", None)

    return cleaned


def _sanitize_findings_for_prompt(findings: Any) -> Any:
    if not isinstance(findings, list):
        return findings
    kept: list[Any] = []
    for item in findings:
        if not isinstance(item, dict):
            kept.append(item)
            continue
        severity = str(item.get("severity") or "").lower()
        title = str(item.get("title") or "").lower()
        if severity == "info" and (
            "not present" in title
            or "missing" in title
            or "sparse or empty" in title
            or "empty optional" in title
        ):
            continue
        kept.append(item)
    return kept


def sanitize_narrative_text(text: str | None) -> str | None:
    """Drop format-apology / incomplete-data sentences from user-facing narratives."""
    if not text or not text.strip():
        return text

    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    kept: list[str] = []
    for sentence in sentences:
        lowered = sentence.lower()
        if any(marker in lowered for marker in _UNWANTED_SENTENCE_MARKERS):
            continue
        kept.append(sentence.strip())

    if not kept:
        return None

    cleaned = " ".join(kept)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or None


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

    vendor_flags = _as_str_list(context.get("vendor_flags"))
    metadata_flags = _as_str_list(context.get("metadata_flags"))
    if vendor_flags or metadata_flags:
        combined: list[str] = []
        seen_combo: set[str] = set()
        for item in [*vendor_flags, *metadata_flags, *flags]:
            key = item.strip().lower()
            if not key or key in seen_combo or looks_like_recommendation(item):
                continue
            seen_combo.add(key)
            combined.append(item.strip())
        flags = combined or flags

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

    has_visual = bool(context.get("has_localized_visual_evidence"))
    visual_note = (
        ""
        if has_visual
        else f" {NO_LOCALIZED_VISUAL_EVIDENCE}"
    )

    if unique_flags:
        top = unique_flags[:3]
        listed = ", ".join(top)
        extra = f" (+{len(unique_flags) - 3} more)" if len(unique_flags) > 3 else ""
        vendor_part = ""
        meta_part = ""
        if vendor_flags:
            vendor_part = f" Vendor flags: {', '.join(vendor_flags[:2])}"
            if len(vendor_flags) > 2:
                vendor_part += f" (+{len(vendor_flags) - 2} more)"
            vendor_part += "."
        if metadata_flags:
            meta_part = f" Metadata flags: {', '.join(metadata_flags[:2])}"
            if len(metadata_flags) > 2:
                meta_part += f" (+{len(metadata_flags) - 2} more)"
            meta_part += "."
        return (
            f"Overall assessment: {verdict_label}. "
            f"Primary forensic indicators: {listed}{extra}."
            f"{vendor_part}{meta_part}"
        ).strip()

    if _verdict_is_clean(context):
        return (
            f"Overall assessment: {verdict_label}. "
            "Cross-layer examination did not identify suspicious forensic indicators "
            f"of document manipulation.{visual_note}"
        ).strip()

    return (
        f"Overall assessment: {verdict_label}. "
        f"No discrete suspicious forensic indicators stood out in this examination.{visual_note}"
    ).strip()


def _summary_context(context: dict[str, Any]) -> dict[str, Any]:
    """Keep score + flag fields — never pass recommendation text to the model."""
    slim: dict[str, Any] = {}

    for key in (
        "engine",
        "verdict",
        "overall_status",
        "final_result",
        "fraud_types",
        "fraud_score",
        "risk_level",
        "risk_score",
        "ai_probability",
        "ml_label",
        "ml_score",
        "ocr_label",
        "ocr_score",
        "key_indicators",
        "visual_patterns",
        "metadata_notes",
        "reasoning",
        "raw_score",
        "has_localized_visual_evidence",
        "localized_visual_count",
        "localized_visual_findings",
        "text_score",
        "image_score",
        "pdf_score",
        "document_type",
        "vendor_identity",
        "ocr_fields",
        "pdf_metadata",
        "pdf_structure_findings",
        "pdf_structure_summary",
        "pdf_structure_sources",
        "vendor_flags",
        "metadata_flags",
        "certificate_flags",
        "file_information",
    ):
        value = context.get(key)
        if value not in (None, "", [], {}):
            # Drop recommendation-like reasoning so it cannot leak into prompts/fallbacks.
            if key == "reasoning" and isinstance(value, str) and looks_like_recommendation(value):
                continue
            slim[key] = value

    flags = _collect_flags(context)
    vendor_flags = _as_str_list(context.get("vendor_flags"))
    metadata_flags = _as_str_list(context.get("metadata_flags"))
    if vendor_flags:
        slim["vendor_flags"] = vendor_flags
    if metadata_flags:
        slim["metadata_flags"] = metadata_flags
    certificate_flags = _as_str_list(context.get("certificate_flags"))
    if certificate_flags:
        slim["certificate_flags"] = certificate_flags
        flags = certificate_flags
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

    if "file_information" in slim:
        slim["file_information"] = _sanitize_file_context(slim["file_information"])
    if "pdf_metadata" in slim:
        slim["pdf_metadata"] = _sanitize_file_context(slim["pdf_metadata"])
    if "pdf_structure_findings" in slim:
        slim["pdf_structure_findings"] = _sanitize_findings_for_prompt(
            slim["pdf_structure_findings"]
        )
    if isinstance(slim.get("pdf_structure_summary"), str):
        slim["pdf_structure_summary"] = sanitize_narrative_text(slim["pdf_structure_summary"])

    return slim


def _pdf_structure_prompt_context(analysis: PdfStructureAnalyzeResponse) -> dict[str, Any]:
    ocr = analysis.ocr_fields
    metadata = analysis.pdf_metadata
    findings_payload: list[dict[str, Any]] = []
    for item in analysis.findings[:20]:
        if item.severity == "info" and (
            "not present" in item.title.lower()
            or "missing" in item.title.lower()
            or "sparse or empty" in item.title.lower()
        ):
            continue
        findings_payload.append(
            {
                "rule_id": item.rule_id,
                "severity": item.severity,
                "status": item.status,
                "title": item.title,
                "description": item.description,
            }
        )

    findings_payload = _sanitize_findings_for_prompt(findings_payload)

    ocr_payload: dict[str, Any] | None = None
    if ocr is not None:
        ocr_payload = ocr.model_dump(exclude={"raw", "detected_text"})
        text = ocr.detected_text
        if isinstance(text, str) and text.strip():
            ocr_payload["detected_text_excerpt"] = text.strip()[:1_500]

    return {
        "ocr_fields": ocr_payload,
        "pdf_metadata": _sanitize_file_context(metadata.model_dump()) if metadata is not None else None,
        "findings": findings_payload,
        "internal_summary": sanitize_narrative_text(analysis.summary),
        "sources": analysis.sources,
    }


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
