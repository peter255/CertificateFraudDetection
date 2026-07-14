from __future__ import annotations

from app.application.dto.pdf_structure import PdfStructureFinding
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.rules.base import finding


class MissingCreationDateRule:
    rule_id = "PDF_MISSING_CREATION_DATE"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        if not context.metadata.is_pdf:
            return None
        if context.metadata.creation_date:
            return None
        return finding(
            rule_id=self.rule_id,
            severity="warning",
            status="warning",
            title="Missing creation date",
            description="PDF metadata does not include a creation date.",
            evidence={"creation_date": None, "is_pdf": True},
            recommendation="Missing creation metadata can indicate stripping or non-standard export tooling.",
            confidence=0.8,
        )


class MissingProducerRule:
    rule_id = "PDF_MISSING_PRODUCER"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        if not context.metadata.is_pdf:
            return None
        if context.metadata.producer:
            return None
        return finding(
            rule_id=self.rule_id,
            severity="warning",
            status="warning",
            title="Missing producer",
            description="PDF metadata does not include a Producer field.",
            evidence={"producer": None},
            recommendation="Note the absence of producer software for provenance review.",
            confidence=0.75,
        )


class MissingCreatorRule:
    rule_id = "PDF_MISSING_CREATOR"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        if not context.metadata.is_pdf:
            return None
        if context.metadata.creator:
            return None
        return finding(
            rule_id=self.rule_id,
            severity="info",
            status="warning",
            title="Missing creator",
            description="PDF metadata does not include a Creator field.",
            evidence={"creator": None},
            recommendation="Creator absence alone is not conclusive; combine with other indicators.",
            confidence=0.65,
        )


class EmptyMetadataRule:
    rule_id = "PDF_EMPTY_METADATA"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        if not context.metadata.is_pdf:
            return None

        core_values = [
            context.metadata.creation_date,
            context.metadata.modification_date,
            context.metadata.producer,
            context.metadata.creator,
            context.metadata.title,
            context.metadata.author,
            context.metadata.subject,
        ]
        if any(value for value in core_values):
            return None

        return finding(
            rule_id=self.rule_id,
            severity="warning",
            status="warning",
            title="Empty PDF metadata",
            description=(
                "Core PDF metadata fields are empty or absent. "
                "This can indicate metadata stripping or generation by atypical tooling."
            ),
            evidence={
                "page_count": context.metadata.page_count,
                "pdf_version": context.metadata.pdf_version,
                "document_properties": context.metadata.document_properties,
            },
            recommendation="Treat empty metadata as a supportive warning, not a fraud verdict.",
            confidence=0.8,
        )


class MetadataInconsistencyRule:
    rule_id = "PDF_METADATA_INCONSISTENCY"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        if not context.metadata.is_pdf:
            return None

        producer = (context.metadata.producer or "").strip().lower()
        creator = (context.metadata.creator or "").strip().lower()
        issues: list[str] = []

        if producer and creator and producer == creator:
            # Same value is common and not always suspicious; skip.
            pass

        if context.metadata.page_count is not None and context.metadata.page_count <= 0:
            issues.append("page_count is non-positive")

        if context.metadata.parse_error:
            issues.append(f"metadata parse error: {context.metadata.parse_error}")

        # Creator/Producer mismatch with image-editor producer already covered elsewhere;
        # here flag contradictory version/page claims when properties disagree.
        props = context.metadata.document_properties or {}
        prop_pages = props.get("page_count") or props.get("/Pages")
        if (
            prop_pages is not None
            and context.metadata.page_count is not None
            and str(prop_pages).isdigit()
            and int(prop_pages) != context.metadata.page_count
        ):
            issues.append("page_count disagrees with document properties")

        if not issues:
            return None

        return finding(
            rule_id=self.rule_id,
            severity="warning",
            status="warning",
            title="PDF metadata inconsistencies",
            description="Internal PDF metadata fields are inconsistent with each other.",
            evidence={"issues": issues, "document_properties": props},
            recommendation="Review metadata extraction output for conflicting document properties.",
            confidence=0.7,
        )
