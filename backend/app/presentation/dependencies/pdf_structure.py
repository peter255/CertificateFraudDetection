from __future__ import annotations

from fastapi import Depends

from app.application.interfaces.ai_analysis_port import IAiAnalysisPort
from app.application.interfaces.document_intelligence_port import IDocumentIntelligencePort
from app.application.interfaces.pdf_metadata_port import IPdfMetadataPort
from app.application.PromptTemplates.loader import PromptTemplateLoader
from app.application.services.pdf_structure.analysis_service import PdfStructureAnalysisService
from app.application.services.pdf_structure.llm_prompt_service import PdfStructureLlmPromptService
from app.application.services.pdf_structure.prompt_builder import PdfForensicPromptBuilder
from app.application.services.pdf_structure_enrichment import PdfStructureEnrichmentService
from app.infrastructure.azure_document_intelligence.client import AzureDocumentIntelligenceClient
from app.infrastructure.configuration.settings import Settings
from app.infrastructure.pdf.metadata_extractor import PypdfMetadataExtractor
from app.presentation.dependencies.container import provide_ai_client, provide_settings


def provide_document_intelligence_client(
    settings: Settings = Depends(provide_settings),
) -> IDocumentIntelligencePort:
    return AzureDocumentIntelligenceClient(settings=settings)


def provide_pdf_metadata_extractor() -> IPdfMetadataPort:
    return PypdfMetadataExtractor()


def provide_prompt_template_loader() -> PromptTemplateLoader:
    return PromptTemplateLoader()


def provide_pdf_forensic_prompt_builder(
    template_loader: PromptTemplateLoader = Depends(provide_prompt_template_loader),
) -> PdfForensicPromptBuilder:
    return PdfForensicPromptBuilder(template_loader=template_loader)


def provide_pdf_structure_llm_prompts(
    prompt_builder: PdfForensicPromptBuilder = Depends(provide_pdf_forensic_prompt_builder),
) -> PdfStructureLlmPromptService:
    return PdfStructureLlmPromptService(prompt_builder=prompt_builder)


def provide_pdf_structure_analysis_service(
    document_intelligence: IDocumentIntelligencePort = Depends(provide_document_intelligence_client),
    pdf_metadata: IPdfMetadataPort = Depends(provide_pdf_metadata_extractor),
    ai_client: IAiAnalysisPort = Depends(provide_ai_client),
    llm_prompts: PdfStructureLlmPromptService = Depends(provide_pdf_structure_llm_prompts),
) -> PdfStructureAnalysisService:
    return PdfStructureAnalysisService(
        document_intelligence=document_intelligence,
        pdf_metadata=pdf_metadata,
        ai_client=ai_client,
        llm_prompts=llm_prompts,
    )


def provide_pdf_structure_enrichment(
    analyzer: PdfStructureAnalysisService = Depends(provide_pdf_structure_analysis_service),
) -> PdfStructureEnrichmentService:
    return PdfStructureEnrichmentService(analyzer=analyzer)
