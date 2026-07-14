from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.application.PromptTemplates.loader import PromptTemplateLoader
from app.application.PromptTemplates.names import PdfForensicTemplateNames
from app.application.dto.pdf_structure import (
    OcrExtractedFields,
    PdfMetadata,
    PdfStructureFinding,
)
from app.application.services.pdf_structure.prompt_builder import PdfForensicPromptBuilder


@pytest.fixture
def builder() -> PdfForensicPromptBuilder:
    return PdfForensicPromptBuilder()


@pytest.fixture
def sample_ocr() -> OcrExtractedFields:
    return OcrExtractedFields(
        holder_name="Ada Lovelace",
        certificate_name="BSc Computer Science",
        issuer="University of London",
        award_date="2020-06-01",
        issue_date="2020-06-15",
        expiration_date=None,
        certificate_id="CERT-42",
        qr_code="https://verify.example/CERT-42",
        detected_text="Ada Lovelace\nUniversity of London\nAwarded 2020-06-01",
        key_value_pairs={"Issuer": "University of London", "ID": "CERT-42"},
    )


@pytest.fixture
def sample_metadata() -> PdfMetadata:
    return PdfMetadata(
        creation_date="D:20240601120000Z",
        modification_date="D:20240602120000Z",
        producer="Adobe Photoshop 2024",
        creator="Canva",
        pdf_version="1.7",
        page_count=1,
        file_size=12345,
        is_pdf=True,
    )


@pytest.fixture
def sample_indicators() -> list[PdfStructureFinding]:
    return [
        PdfStructureFinding(
            rule_id="PDF_SUSPICIOUS_PRODUCER",
            severity="warning",
            status="warning",
            title="Suspicious producer / creator software",
            description="Producer references image-editing software.",
            evidence={"producer": "Adobe Photoshop 2024"},
            recommendation="Flag for provenance review.",
            confidence=0.85,
        )
    ]


def test_logical_consistency_prompt_includes_all_dynamic_sections(
    builder: PdfForensicPromptBuilder,
    sample_ocr: OcrExtractedFields,
    sample_metadata: PdfMetadata,
    sample_indicators: list[PdfStructureFinding],
) -> None:
    prompt = builder.build_logical_consistency_prompt(
        ocr_result=sample_ocr,
        metadata=sample_metadata,
        fraud_indicators=sample_indicators,
    )

    assert "Analyze metadata" in prompt
    assert "logical inconsistencies" in prompt
    assert "suspicious indicators" in prompt
    assert "Never declare forgery" in prompt
    assert "Produce JSON only" in prompt or "JSON only" in prompt

    assert "OCR Result:" in prompt
    assert "Metadata:" in prompt
    assert "Existing Fraud Indicators:" in prompt

    assert "Ada Lovelace" in prompt
    assert "Adobe Photoshop 2024" in prompt
    assert "PDF_SUSPICIOUS_PRODUCER" in prompt

    # Template must not leave unsubstituted placeholders.
    assert "{ocr_result}" not in prompt
    assert "{metadata}" not in prompt
    assert "{fraud_indicators}" not in prompt


def test_logical_consistency_prompt_accepts_plain_mappings(
    builder: PdfForensicPromptBuilder,
) -> None:
    prompt = builder.build_logical_consistency_prompt(
        ocr_result={"holder_name": "Grace Hopper", "issuer": "Navy"},
        metadata={"producer": "Unknown Tool", "is_pdf": True},
        fraud_indicators=[
            {
                "rule_id": "ENG_SIGNAL_1",
                "severity": "warning",
                "description": "Incremental update anomaly",
                "category": "PDF Structure",
            }
        ],
    )

    assert "Grace Hopper" in prompt
    assert "Unknown Tool" in prompt
    assert "ENG_SIGNAL_1" in prompt
    assert "Incremental update anomaly" in prompt


def test_findings_summary_prompt_is_json_only_instruction(
    builder: PdfForensicPromptBuilder,
    sample_indicators: list[PdfStructureFinding],
) -> None:
    prompt = builder.build_findings_summary_prompt(findings=sample_indicators)

    assert "JSON only" in prompt
    assert "Never declare forgery" in prompt
    assert "PDF_SUSPICIOUS_PRODUCER" in prompt
    assert "{findings}" not in prompt


def test_ocr_text_is_excerpted(builder: PdfForensicPromptBuilder) -> None:
    long_text = "A" * 5_000
    prompt = builder.build_logical_consistency_prompt(
        ocr_result=OcrExtractedFields(detected_text=long_text),
        metadata=PdfMetadata(is_pdf=True),
        fraud_indicators=[],
    )

    # Full 5000-char blob must not appear; excerpt marker should.
    assert "A" * 5_000 not in prompt
    assert "…" in prompt


def test_template_loader_reads_from_prompt_templates_folder() -> None:
    loader = PromptTemplateLoader()
    text = loader.load(PdfForensicTemplateNames.LOGICAL_CONSISTENCY)

    assert "Analyze metadata" in text
    assert "{ocr_result}" in text
    assert "{metadata}" in text
    assert "{fraud_indicators}" in text


def test_template_loader_rejects_missing_placeholder() -> None:
    root = Path(__file__).resolve().parents[2] / "app" / "application" / "PromptTemplates"
    loader = PromptTemplateLoader(templates_root=root)

    with pytest.raises(ValueError, match="missing placeholder"):
        loader.render(
            PdfForensicTemplateNames.LOGICAL_CONSISTENCY,
            ocr_result="{}",
            metadata="{}",
            # fraud_indicators intentionally omitted
        )


def test_template_loader_rejects_path_traversal() -> None:
    loader = PromptTemplateLoader()
    with pytest.raises(ValueError, match="escapes templates root"):
        loader.load("../names.py")


def test_embedded_json_sections_are_valid(
    builder: PdfForensicPromptBuilder,
    sample_ocr: OcrExtractedFields,
    sample_metadata: PdfMetadata,
    sample_indicators: list[PdfStructureFinding],
) -> None:
    prompt = builder.build_logical_consistency_prompt(
        ocr_result=sample_ocr,
        metadata=sample_metadata,
        fraud_indicators=sample_indicators,
    )

    ocr_block = prompt.split("OCR Result:\n", 1)[1].split("\n\nMetadata:", 1)[0].strip()
    metadata_block = (
        prompt.split("Metadata:\n", 1)[1]
        .split("\n\nExisting Fraud Indicators:", 1)[0]
        .strip()
    )
    indicators_block = prompt.split("Existing Fraud Indicators:\n", 1)[1].strip()

    ocr_json = json.loads(ocr_block)
    metadata_json = json.loads(metadata_block)
    indicators_json = json.loads(indicators_block)

    assert ocr_json["holder_name"] == "Ada Lovelace"
    assert metadata_json["producer"] == "Adobe Photoshop 2024"
    assert indicators_json[0]["rule_id"] == "PDF_SUSPICIOUS_PRODUCER"
