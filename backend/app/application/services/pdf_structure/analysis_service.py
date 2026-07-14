from __future__ import annotations

import time
from datetime import datetime, timezone

from app.application.dto.pdf_structure import (
    OcrExtractedFields,
    PdfMetadata,
    PdfStructureAnalyzeResponse,
    PdfStructureFinding,
)
from app.application.interfaces.ai_analysis_port import IAiAnalysisPort
from app.application.interfaces.document_intelligence_port import IDocumentIntelligencePort
from app.application.interfaces.pdf_metadata_port import IPdfMetadataPort
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.contextual.reasoner import ContextualReasoner
from app.application.services.pdf_structure.llm_prompt_service import PdfStructureLlmPromptService
from app.application.services.pdf_structure.rules.registry import (
    ForensicRuleRegistry,
    build_default_rule_registry,
)
from app.shared.logging.logger import get_logger

logger = get_logger(__name__)


class PdfStructureAnalysisService:
    """
    Orchestrates forensic PDF Structure Analysis:

    1. Azure Document Intelligence OCR fields
    2. PDF metadata extraction
    3. Deterministic atomic forensic rules
    4. Deterministic contextual combination reasoning
    5. Optional LLM logical-consistency analysis
    """

    def __init__(
        self,
        *,
        document_intelligence: IDocumentIntelligencePort,
        pdf_metadata: IPdfMetadataPort,
        ai_client: IAiAnalysisPort,
        llm_prompts: PdfStructureLlmPromptService | None = None,
        rules: ForensicRuleRegistry | None = None,
        contextual_reasoner: ContextualReasoner | None = None,
    ) -> None:
        self._document_intelligence = document_intelligence
        self._pdf_metadata = pdf_metadata
        self._ai_client = ai_client
        self._llm_prompts = llm_prompts or PdfStructureLlmPromptService()
        self._rules = rules or build_default_rule_registry()
        self._contextual_reasoner = contextual_reasoner or ContextualReasoner()

    def is_available(self) -> bool:
        """Pipeline can run when metadata extraction is available (always) or OCR is configured."""
        return True

    async def analyze(
        self,
        content: bytes,
        *,
        filename: str,
        content_type: str | None = None,
    ) -> PdfStructureAnalyzeResponse:
        started = time.perf_counter()
        sources = {
            "ocr": False,
            "metadata": False,
            "rules": False,
            "contextual": False,
            "llm": False,
        }

        ocr_configured = self._document_intelligence.is_configured()
        ocr_fields = await self._extract_ocr(content, filename=filename, content_type=content_type)
        # True when OCR was attempted (configured). Failures still count as attempted.
        sources["ocr"] = ocr_configured

        metadata = self._pdf_metadata.extract(
            content,
            filename=filename,
            file_size=len(content),
        )
        # Extractor always runs; keep prior semantics (True unless a future failure mode sets both).
        sources["metadata"] = metadata.is_pdf or metadata.parse_error is None

        context = PdfStructureContext(
            ocr=ocr_fields,
            metadata=metadata,
            filename=filename,
            content_type=content_type,
            extras={
                "ocr_configured": ocr_configured,
                "ocr_attempted": ocr_configured,
            },
        )

        atomic_findings = self._rules.evaluate_all(context)
        sources["rules"] = True

        contextual_findings = self._contextual_reasoner.evaluate(
            context=context,
            atomic_findings=atomic_findings,
        )
        sources["contextual"] = True

        # Feed both atomic and contextual indicators to the LLM stage.
        deterministic_findings = [*contextual_findings, *atomic_findings]

        llm_findings, llm_summary = await self._run_llm_stage(
            ocr=ocr_fields,
            metadata=metadata,
            rule_findings=deterministic_findings,
        )
        if llm_findings or llm_summary:
            sources["llm"] = True

        # Contextual composites first — they are the stronger, explainable combinations.
        findings = _dedupe_findings([*contextual_findings, *atomic_findings, *llm_findings])
        # When there is no warning/critical forensic evidence, always use neutral
        # informational language — do not let an LLM reframe common PDF traits as suspicion.
        if _has_forensic_evidence(findings):
            summary = llm_summary or _build_deterministic_summary(findings)
        else:
            summary = _build_deterministic_summary(findings)

        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "PDF structure analysis complete filename=%s findings=%s duration_ms=%s sources=%s",
            filename,
            len(findings),
            duration_ms,
            sources,
        )

        return PdfStructureAnalyzeResponse(
            status="completed",
            findings=findings,
            ocr_fields=ocr_fields,
            pdf_metadata=metadata,
            summary=summary,
            analyzed_at=datetime.now(timezone.utc),
            duration_ms=duration_ms,
            sources=sources,
        )

    async def _extract_ocr(
        self,
        content: bytes,
        *,
        filename: str,
        content_type: str | None,
    ) -> OcrExtractedFields:
        if not self._document_intelligence.is_configured():
            logger.info("Azure Document Intelligence not configured — OCR stage skipped.")
            return OcrExtractedFields()

        try:
            return await self._document_intelligence.extract_fields(
                content,
                filename=filename,
                content_type=content_type,
            )
        except Exception as exc:  # noqa: BLE001 — optional stage must not fail pipeline
            logger.warning("Azure Document Intelligence OCR failed: %s", exc)
            return OcrExtractedFields(raw={"error": str(exc)})

    async def _run_llm_stage(
        self,
        *,
        ocr: OcrExtractedFields,
        metadata: PdfMetadata,
        rule_findings: list[PdfStructureFinding],
    ) -> tuple[list[PdfStructureFinding], str | None]:
        if not self._ai_client.is_configured():
            return [], None

        try:
            prompt = self._llm_prompts.build_logical_consistency_prompt(
                ocr=ocr,
                metadata=metadata,
                fraud_indicators=rule_findings,
            )
            raw = await self._ai_client.generate_json_completion(prompt=prompt)
            findings, summary = self._llm_prompts.parse_logical_consistency_response(raw)

            if summary is None and findings:
                summary_prompt = self._llm_prompts.build_summary_prompt(findings=findings)
                summary_raw = await self._ai_client.generate_json_completion(prompt=summary_prompt)
                summary = self._llm_prompts.parse_summary_response(summary_raw)

            return findings, summary
        except Exception as exc:  # noqa: BLE001
            logger.warning("PDF structure LLM analysis failed: %s", exc)
            return [], None


def _dedupe_findings(findings: list[PdfStructureFinding]) -> list[PdfStructureFinding]:
    seen: set[str] = set()
    unique: list[PdfStructureFinding] = []
    for item in findings:
        key = f"{item.rule_id}|{item.title}|{item.status}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _has_forensic_evidence(findings: list[PdfStructureFinding]) -> bool:
    """True when findings include actual forensic indicators (not info-only traits)."""
    for item in findings:
        if item.rule_id.startswith("CTX_"):
            return True
        if item.severity in {"warning", "critical"}:
            return True
        if item.status in {"warning", "fail"}:
            return True
    return False


def _build_deterministic_summary(findings: list[PdfStructureFinding]) -> str | None:
    if not findings:
        return (
            "File-structure review found no suspicious forensic indicators. "
            "No PDF structure or metadata inconsistencies were identified."
        )

    contextual = [f for f in findings if f.rule_id.startswith("CTX_")]
    critical = [f for f in findings if f.severity == "critical"]
    warnings = [f for f in findings if f.severity == "warning"]
    infos = [f for f in findings if f.severity == "info"]
    parts: list[str] = []

    if contextual:
        parts.append(
            "Combined forensic indicators: "
            + "; ".join(item.title for item in contextual[:3])
            + "."
        )
    if critical:
        titles = [item.title for item in critical if not item.rule_id.startswith("CTX_")][:3]
        if titles:
            parts.append("Critical PDF structure indicators: " + "; ".join(titles) + ".")
    if warnings:
        titles = [
            item.title
            for item in warnings
            if not item.rule_id.startswith("CTX_") and item.severity != "critical"
        ][:3]
        if titles:
            parts.append("Forensic warning indicators: " + "; ".join(titles) + ".")

    if parts:
        # Real forensic evidence present — keep concise and distinct from info notes.
        if infos:
            parts.append(
                "Separate informational document characteristics were also noted "
                "(not treated as manipulation evidence)."
            )
        return " ".join(parts)

    # Info-only / clean path — neutral informational language only.
    if infos:
        characteristics = "; ".join(item.title for item in infos[:3])
        return (
            "File-structure review found no suspicious forensic indicators of manipulation. "
            f"Informational document characteristics noted: {characteristics}. "
            "These are common PDF/OCR traits and are not evidence of tampering."
        )

    return (
        "File-structure review found no suspicious forensic indicators. "
        "Observed notes are informational document characteristics only."
    )
