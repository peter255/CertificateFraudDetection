from __future__ import annotations

from app.application.dto.pdf_structure import PdfStructureFinding
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.rules.base import finding

# Fields considered important for certificate forensic review.
IMPORTANT_OCR_FIELDS: tuple[tuple[str, str], ...] = (
    ("holder_name", "Holder Name"),
    ("certificate_name", "Certificate Name"),
    ("issuer", "Issuer"),
    ("award_date", "Award Date"),
    ("issue_date", "Issue Date"),
    ("certificate_id", "Certificate ID"),
)


class OcrMissingImportantFieldsRule:
    rule_id = "OCR_MISSING_IMPORTANT_FIELDS"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        # Skip when Azure Document Intelligence was not configured / not attempted.
        if not context.extras.get("ocr_attempted", False):
            return None

        missing: list[str] = []
        present: dict[str, str] = {}

        for attr, label in IMPORTANT_OCR_FIELDS:
            value = getattr(context.ocr, attr, None)
            if value and str(value).strip():
                present[attr] = str(value).strip()
            else:
                missing.append(label)

        # Award OR issue date is acceptable — don't require both.
        has_date = bool(present.get("award_date") or present.get("issue_date"))
        if has_date:
            missing = [item for item in missing if item not in {"Award Date", "Issue Date"}]
        else:
            # Keep a single combined missing date label.
            if "Award Date" in missing and "Issue Date" in missing:
                missing = [item for item in missing if item not in {"Award Date", "Issue Date"}]
                missing.append("Award/Issue Date")

        has_any_text = bool(
            (context.ocr.detected_text and context.ocr.detected_text.strip())
            or present
            or context.ocr.key_value_pairs
        )

        if not missing:
            return None

        # OCR gaps / extraction failures are informational only — never fraud by themselves.
        if not has_any_text:
            description = (
                "Azure Document Intelligence did not extract readable certificate text. "
                "OCR extraction failure alone is not a fraud indicator."
            )
        else:
            description = (
                "Azure Document Intelligence did not extract one or more certificate fields "
                f"({', '.join(missing)}). Missing OCR fields alone are not fraud indicators."
            )

        return finding(
            rule_id=self.rule_id,
            severity="info",
            status="pass",
            title="OCR missing important certificate fields",
            description=description,
            evidence={
                "missing_fields": missing,
                "present_fields": present,
                "has_detected_text": bool(context.ocr.detected_text),
                "ocr_extraction_failed": not has_any_text,
            },
            recommendation=(
                "Manually verify whether the fields are present on the document. "
                "Treat OCR gaps as extraction limitations unless corroborated by "
                "independent forensic indicators."
            ),
            confidence=0.75 if has_any_text else 0.7,
        )
