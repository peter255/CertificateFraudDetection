from __future__ import annotations

import re

from app.application.dto.pdf_structure import PdfStructureFinding
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.rules.base import finding

# Image / design tools that are atypical producers for authentic certificates.
# These raise warning flags — they do not declare fraud by themselves.
SUSPICIOUS_PRODUCERS: tuple[str, ...] = (
    "adobe photoshop",
    "photoshop",
    "canva",
    "paint.net",
    "paintnet",
    "microsoft paint",
    "mspaint",
    "paint",
    "gimp",
    "photopea",
    "pixlr",
    "coreldraw",
    "corel draw",
    "affinity designer",
    "affinity photo",
)

# Common legitimate / known PDF producers (not exhaustive).
KNOWN_PRODUCERS: tuple[str, ...] = (
    "adobe",
    "acrobat",
    "quartz",
    "macos",
    "microsoft",
    "word",
    "libreoffice",
    "openoffice",
    "chrome",
    "chromium",
    "edge",
    "webkit",
    "prince",
    "wkhtmltopdf",
    "reportlab",
    "itext",
    "pdfkit",
    "weasyprint",
    "ghostscript",
    "pdflatex",
    "xelatex",
    "typst",
    "skia",
    "cairo",
    "cups",
    "foxit",
    "nitro",
    "pdf-xchange",
)


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def match_suspicious_producer(producer: str | None) -> str | None:
    normalized = _normalize(producer)
    if not normalized:
        return None

    # Longer / more specific markers first to avoid weak substring hits.
    ordered = sorted(SUSPICIOUS_PRODUCERS, key=len, reverse=True)
    for marker in ordered:
        if marker == "paint":
            # Match standalone Paint / MS Paint, not substrings inside other words.
            if re.search(r"(?<![a-z])(?:ms\s*)?paint(?![a-z.])", normalized):
                return marker
            continue
        if marker in normalized:
            return marker
    return None


def is_unknown_producer(producer: str | None) -> bool:
    normalized = _normalize(producer)
    if not normalized:
        return False
    if match_suspicious_producer(normalized):
        return False
    return not any(known in normalized for known in KNOWN_PRODUCERS)


class SuspiciousProducerRule:
    rule_id = "PDF_SUSPICIOUS_PRODUCER"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        if not context.metadata.is_pdf:
            return None
        matched = match_suspicious_producer(context.metadata.producer)
        creator_match = match_suspicious_producer(context.metadata.creator)
        hit = matched or creator_match
        if not hit:
            return None

        field = "producer" if matched else "creator"
        value = context.metadata.producer if matched else context.metadata.creator
        return finding(
            rule_id=self.rule_id,
            severity="warning",
            status="warning",
            title="Suspicious producer / creator software",
            description=(
                f"The PDF {field} references design/image-editing software "
                f"({hit}), which is uncommon for authentic certificate issuance workflows."
            ),
            evidence={
                "field": field,
                "value": value,
                "matched_marker": hit,
                "producer": context.metadata.producer,
                "creator": context.metadata.creator,
            },
            recommendation=(
                "Flag for review — image editors as PDF producers are suspicious indicators, "
                "not proof of fraud."
            ),
            confidence=0.85,
        )


class UnknownProducerRule:
    rule_id = "PDF_UNKNOWN_PRODUCER"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        if not context.metadata.is_pdf:
            return None
        producer = context.metadata.producer
        if not producer:
            return None
        if not is_unknown_producer(producer):
            return None
        return finding(
            rule_id=self.rule_id,
            severity="info",
            status="warning",
            title="Unknown PDF producer",
            description=(
                "The PDF Producer field does not match commonly recognized document generators."
            ),
            evidence={"producer": producer},
            recommendation="Research the producer string and compare against issuer tooling norms.",
            confidence=0.6,
        )
