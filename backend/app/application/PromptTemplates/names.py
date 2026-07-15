from __future__ import annotations


class PdfForensicTemplateNames:
    """Relative paths (under PromptTemplates/) for PDF forensic prompts."""

    LOGICAL_CONSISTENCY = "pdf_forensic/logical_consistency.txt"
    FINDINGS_SUMMARY = "pdf_forensic/findings_summary.txt"
    VENDOR_STRUCTURE_CROSSCHECK = "pdf_forensic/vendor_structure_crosscheck.txt"


class ReportNarrativeTemplateNames:
    """Relative paths for enterprise AI report narrative prompts."""

    EXECUTIVE_SUMMARY = "report_narrative/executive_summary.txt"
    CATEGORY_SUMMARY = "report_narrative/category_summary.txt"
