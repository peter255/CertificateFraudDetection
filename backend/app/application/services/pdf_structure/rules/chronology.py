from __future__ import annotations

from app.application.dto.pdf_structure import PdfStructureFinding
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.date_utils import is_invalid_timestamp
from app.application.services.pdf_structure.rules.base import finding


class ModificationBeforeCreationRule:
    rule_id = "PDF_MOD_BEFORE_CREATION"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        dates = context.parsed_dates()
        created = dates["creation_date"]
        modified = dates["modification_date"]
        if created is None or modified is None:
            return None
        if modified < created:
            return finding(
                rule_id=self.rule_id,
                severity="critical",
                status="fail",
                title="Modification date before creation date",
                description=(
                    "The PDF modification timestamp precedes the creation timestamp, "
                    "which is chronologically impossible for a consistent document."
                ),
                evidence={
                    "creation_date": context.metadata.creation_date,
                    "modification_date": context.metadata.modification_date,
                },
                recommendation=(
                    "Inspect editing history and provenance; treat metadata chronology as suspicious."
                ),
                confidence=0.95,
            )
        return None


class AwardBeforeCreationRule:
    rule_id = "PDF_AWARD_BEFORE_CREATION"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        dates = context.parsed_dates()
        award = dates["award_date"] or dates["issue_date"]
        created = dates["creation_date"]
        if award is None or created is None:
            return None
        if award < created:
            label = "award_date" if dates["award_date"] else "issue_date"
            return finding(
                rule_id=self.rule_id,
                severity="warning",
                status="warning",
                title="Award/issue date before PDF creation date",
                description=(
                    f"The certificate {label.replace('_', ' ')} precedes the PDF creation date. "
                    "This can be legitimate for digitized paper certificates, but warrants review."
                ),
                evidence={
                    label: getattr(context.ocr, label, None)
                    or (context.ocr.award_date or context.ocr.issue_date),
                    "creation_date": context.metadata.creation_date,
                },
                recommendation=(
                    "Confirm whether the file is a later scan/export of an older certificate."
                ),
                confidence=0.75,
            )
        return None


class AwardAfterModificationRule:
    rule_id = "PDF_AWARD_AFTER_MODIFICATION"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        dates = context.parsed_dates()
        award = dates["award_date"] or dates["issue_date"]
        modified = dates["modification_date"]
        if award is None or modified is None:
            return None
        if award > modified:
            label = "award_date" if dates["award_date"] else "issue_date"
            return finding(
                rule_id=self.rule_id,
                severity="warning",
                status="warning",
                title="Award/issue date after PDF modification date",
                description=(
                    f"The certificate {label.replace('_', ' ')} is later than the PDF "
                    "modification timestamp, suggesting possible metadata inconsistency."
                ),
                evidence={
                    label: context.ocr.award_date or context.ocr.issue_date,
                    "modification_date": context.metadata.modification_date,
                },
                recommendation=(
                    "Cross-check certificate dates against issuer records and file provenance."
                ),
                confidence=0.7,
            )
        return None


class ExpirationBeforeAwardRule:
    rule_id = "PDF_EXPIRATION_BEFORE_AWARD"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        dates = context.parsed_dates()
        expiration = dates["expiration_date"]
        award = dates["award_date"] or dates["issue_date"]
        if expiration is None or award is None:
            return None
        if expiration < award:
            return finding(
                rule_id=self.rule_id,
                severity="critical",
                status="fail",
                title="Expiration date before award date",
                description=(
                    "The expiration date precedes the award/issue date, which is logically impossible."
                ),
                evidence={
                    "expiration_date": context.ocr.expiration_date,
                    "award_date": context.ocr.award_date,
                    "issue_date": context.ocr.issue_date,
                },
                recommendation="Verify extracted dates against the visible certificate text.",
                confidence=0.95,
            )
        return None


class ImpossibleChronologyRule:
    rule_id = "PDF_IMPOSSIBLE_CHRONOLOGY"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        """Catch broader impossible ordering across available timestamps."""
        dates = context.parsed_dates()
        created = dates["creation_date"]
        modified = dates["modification_date"]
        award = dates["award_date"] or dates["issue_date"]
        expiration = dates["expiration_date"]

        issues: list[str] = []
        if created and modified and modified < created:
            issues.append("modification < creation")
        if award and expiration and expiration < award:
            issues.append("expiration < award/issue")
        if created and expiration and expiration < created and award and award > created:
            issues.append("expiration precedes creation while award follows creation")

        # Avoid duplicating the more specific rules when they already cover the case.
        if not issues:
            return None
        already_covered = {
            "modification < creation",
            "expiration < award/issue",
        }
        residual = [item for item in issues if item not in already_covered]
        if not residual:
            return None

        return finding(
            rule_id=self.rule_id,
            severity="critical",
            status="fail",
            title="Impossible chronology across document timestamps",
            description=(
                "Multiple timestamp relationships are mutually inconsistent: "
                + "; ".join(residual)
                + "."
            ),
            evidence={
                "creation_date": context.metadata.creation_date,
                "modification_date": context.metadata.modification_date,
                "award_date": context.ocr.award_date,
                "issue_date": context.ocr.issue_date,
                "expiration_date": context.ocr.expiration_date,
                "issues": residual,
            },
            recommendation="Treat date chronology as a high-priority forensic indicator.",
            confidence=0.9,
        )


class InvalidTimestampsRule:
    rule_id = "PDF_INVALID_TIMESTAMPS"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        invalid: dict[str, str] = {}
        checks = {
            "creation_date": context.metadata.creation_date,
            "modification_date": context.metadata.modification_date,
            "award_date": context.ocr.award_date,
            "issue_date": context.ocr.issue_date,
            "expiration_date": context.ocr.expiration_date,
        }
        for key, value in checks.items():
            if is_invalid_timestamp(value):
                invalid[key] = str(value)

        if not invalid:
            return None

        return finding(
            rule_id=self.rule_id,
            severity="warning",
            status="warning",
            title="Invalid timestamps detected",
            description=(
                "One or more date fields could not be parsed into valid timestamps."
            ),
            evidence={"invalid_fields": invalid},
            recommendation="Manually inspect unparseable date strings on the certificate and in PDF metadata.",
            confidence=0.85,
        )
