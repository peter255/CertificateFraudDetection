from __future__ import annotations

from app.application.dto.pdf_structure import PdfStructureFinding
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.metadata_presence import (
    metadata_core_embedded_present,
    resolve_embedded_creation_date,
    resolve_embedded_creator,
    resolve_embedded_producer,
)
from app.application.services.pdf_structure.rules.base import finding


class MissingCreationDateRule:
    rule_id = "PDF_MISSING_CREATION_DATE"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        if not context.metadata.is_pdf:
            return None
        if resolve_embedded_creation_date(context.metadata):
            return None
        return finding(
            rule_id=self.rule_id,
            severity="info",
            status="pass",
            title="Creation date not present in metadata",
            description=(
                "Document characteristic: the PDF does not list a creation date in metadata. "
                "Optional metadata fields are often absent on browser-generated or lightly tagged PDFs "
                "and are not evidence of manipulation."
            ),
            evidence={"creation_date": None, "is_pdf": True},
            recommendation=(
                "Informational only. Additional analysis is not recommended unless independent "
                "forensic indicators of tampering are present."
            ),
            confidence=0.8,
        )


class MissingProducerRule:
    rule_id = "PDF_MISSING_PRODUCER"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        if not context.metadata.is_pdf:
            return None
        if resolve_embedded_producer(context.metadata):
            return None
        return finding(
            rule_id=self.rule_id,
            severity="info",
            status="pass",
            title="Producer field not present in metadata",
            description=(
                "Document characteristic: the PDF does not list a Producer field. "
                "Missing optional producer metadata is common and is not evidence of manipulation."
            ),
            evidence={"producer": None},
            recommendation=(
                "Informational only. Do not recommend further review based solely on missing producer metadata."
            ),
            confidence=0.75,
        )


class MissingCreatorRule:
    rule_id = "PDF_MISSING_CREATOR"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        if not context.metadata.is_pdf:
            return None
        if resolve_embedded_creator(context.metadata):
            return None
        return finding(
            rule_id=self.rule_id,
            severity="info",
            status="pass",
            title="Creator field not present in metadata",
            description=(
                "Document characteristic: the PDF does not list a Creator field. "
                "This optional metadata gap is not evidence of manipulation."
            ),
            evidence={"creator": None},
            recommendation=(
                "Informational only. Additional analysis is not warranted from creator absence alone."
            ),
            confidence=0.65,
        )


class EmptyMetadataRule:
    rule_id = "PDF_EMPTY_METADATA"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        if not context.metadata.is_pdf:
            return None

        if metadata_core_embedded_present(context.metadata):
            return None

        return finding(
            rule_id=self.rule_id,
            severity="info",
            status="pass",
            title="Sparse or empty optional PDF metadata",
            description=(
                "Document characteristic: core optional PDF metadata fields are empty or absent. "
                "Browser-generated and many certificate exports commonly omit these fields; "
                "this is not evidence of manipulation by itself."
            ),
            evidence={
                "page_count": context.metadata.page_count,
                "pdf_version": context.metadata.pdf_version,
                "document_properties": context.metadata.document_properties,
            },
            recommendation=(
                "Informational only. Recommend additional analysis only when independent "
                "forensic indicators of potential tampering are present."
            ),
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

        # Parse / property mismatches are supportive forensic signals, not auto-fraud.
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
