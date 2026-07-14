from __future__ import annotations

import json
from itertools import islice
from typing import Any, Mapping, Sequence

from app.application.PromptTemplates.loader import PromptTemplateLoader
from app.application.PromptTemplates.names import PdfForensicTemplateNames
from app.application.dto.pdf_structure import (
    OcrExtractedFields,
    PdfMetadata,
    PdfStructureFinding,
)
from app.application.services.pdf_structure.text_utils import excerpt

_DEFAULT_OCR_TEXT_LIMIT = 2_500
_DEFAULT_KV_PAIR_LIMIT = 40
_DEFAULT_INDICATOR_LIMIT = 24
_DEFAULT_FINDINGS_LIMIT = 30

_INDICATOR_EXTRA_KEYS = ("category", "layer", "check", "detector", "fraud_type")


class PdfForensicPromptBuilder:
    """
    Reusable, unit-testable builder for PDF forensic LLM prompts.

    Dynamically assembles prompts from:
    - OCR result
    - PDF metadata
    - Existing fraud indicators

    Prompt prose lives in PromptTemplates; this class only serializes inputs
    and fills placeholders.
    """

    def __init__(
        self,
        template_loader: PromptTemplateLoader | None = None,
        *,
        ocr_text_limit: int = _DEFAULT_OCR_TEXT_LIMIT,
        kv_pair_limit: int = _DEFAULT_KV_PAIR_LIMIT,
        indicator_limit: int = _DEFAULT_INDICATOR_LIMIT,
        findings_limit: int = _DEFAULT_FINDINGS_LIMIT,
    ) -> None:
        self._loader = template_loader or PromptTemplateLoader()
        self._ocr_text_limit = ocr_text_limit
        self._kv_pair_limit = kv_pair_limit
        self._indicator_limit = indicator_limit
        self._findings_limit = findings_limit

    def build_logical_consistency_prompt(
        self,
        *,
        ocr_result: OcrExtractedFields | Mapping[str, Any],
        metadata: PdfMetadata | Mapping[str, Any],
        fraud_indicators: Sequence[PdfStructureFinding | Mapping[str, Any]] | None = None,
    ) -> str:
        """Build the main PDF forensic analysis prompt (JSON-only response)."""
        return self._loader.render(
            PdfForensicTemplateNames.LOGICAL_CONSISTENCY,
            ocr_result=self._to_json(self._normalize_ocr(ocr_result)),
            metadata=self._to_json(self._normalize_metadata(metadata)),
            fraud_indicators=self._to_json(
                self._normalize_indicators(
                    fraud_indicators or [],
                    limit=self._indicator_limit,
                    include_status=True,
                    include_extras=True,
                )
            ),
        )

    def build_findings_summary_prompt(
        self,
        *,
        findings: Sequence[PdfStructureFinding | Mapping[str, Any]],
    ) -> str:
        """Build a short JSON summary prompt from structured findings."""
        return self._loader.render(
            PdfForensicTemplateNames.FINDINGS_SUMMARY,
            findings=self._to_json(
                self._normalize_indicators(
                    findings,
                    limit=self._findings_limit,
                    include_status=False,
                    include_extras=False,
                )
            ),
        )

    def _normalize_ocr(
        self,
        ocr_result: OcrExtractedFields | Mapping[str, Any],
    ) -> dict[str, Any]:
        if isinstance(ocr_result, OcrExtractedFields):
            data = ocr_result.model_dump(exclude={"raw"})
        else:
            data = dict(ocr_result)

        key_value_pairs = data.get("key_value_pairs") or {}
        if isinstance(key_value_pairs, Mapping):
            data["key_value_pairs"] = dict(
                islice(key_value_pairs.items(), self._kv_pair_limit)
            )

        detected = data.get("detected_text")
        data["detected_text_excerpt"] = excerpt(
            detected if isinstance(detected, str) else None,
            self._ocr_text_limit,
        )
        data.pop("detected_text", None)
        return data

    def _normalize_metadata(
        self,
        metadata: PdfMetadata | Mapping[str, Any],
    ) -> dict[str, Any]:
        if isinstance(metadata, PdfMetadata):
            return metadata.model_dump()
        return dict(metadata)

    def _normalize_indicators(
        self,
        indicators: Sequence[PdfStructureFinding | Mapping[str, Any]],
        *,
        limit: int,
        include_status: bool,
        include_extras: bool,
    ) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for item in islice(indicators, limit):
            entry = _indicator_fields(item, include_status=include_status)
            if entry is None:
                continue
            if include_extras and isinstance(item, Mapping) and not isinstance(
                item, PdfStructureFinding
            ):
                for key in _INDICATOR_EXTRA_KEYS:
                    value = item.get(key)
                    if value not in (None, "", [], {}):
                        entry[key] = value
            normalized.append(entry)
        return normalized

    @staticmethod
    def _to_json(value: Any) -> str:
        # Compact JSON keeps prompt tokens lower without changing payload semantics.
        return json.dumps(value, ensure_ascii=False, default=str, separators=(",", ":"))


def _indicator_fields(
    item: PdfStructureFinding | Mapping[str, Any],
    *,
    include_status: bool,
) -> dict[str, Any] | None:
    if isinstance(item, PdfStructureFinding):
        entry: dict[str, Any] = {
            "rule_id": item.rule_id,
            "severity": item.severity,
            "title": item.title,
            "description": item.description,
        }
        if include_status:
            entry["status"] = item.status
        return entry

    if not isinstance(item, Mapping):
        return None

    entry = {
        "rule_id": item.get("rule_id") or item.get("id") or item.get("check"),
        "severity": item.get("severity"),
        "title": item.get("title") or item.get("field_label") or item.get("category"),
        "description": item.get("description") or item.get("detail"),
    }
    if include_status:
        entry["status"] = item.get("status")
    return entry
