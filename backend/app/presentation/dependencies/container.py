from __future__ import annotations

from fastapi import Depends

from app.application.interfaces.ai_analysis_port import IAiAnalysisPort
from app.application.interfaces.storage_port import IStoragePort
from app.application.interfaces.vendor_verification_port import IVendorVerificationPort
from app.application.use_cases.verify_certificate import VerifyCertificateUseCase
from app.domain.repositories.certificate_repository import ICertificateRepository
from app.domain.repositories.verification_report_repository import IVerificationReportRepository
from app.infrastructure.ai.azure_openai.azure_openai_client import AzureOpenAIClient
from app.infrastructure.configuration.settings import Settings, get_settings
from app.infrastructure.persistence.certificate_repository_impl import CertificateRepositoryImpl
from app.infrastructure.persistence.verification_report_repository_impl import VerificationReportRepositoryImpl
from app.infrastructure.storage.storage_adapter import StorageAdapter
from app.infrastructure.vendors.paperwork.paperwork_client import PaperworkClient
from app.infrastructure.vendors.truthscan.truthscan_client import TruthScanClient


def provide_settings() -> Settings:
    return get_settings()


def provide_certificate_repository(
    settings: Settings = Depends(provide_settings),
) -> ICertificateRepository:
    return CertificateRepositoryImpl()


def provide_verification_report_repository(
    settings: Settings = Depends(provide_settings),
) -> IVerificationReportRepository:
    return VerificationReportRepositoryImpl()


def provide_truthscan_client(
    settings: Settings = Depends(provide_settings),
) -> IVendorVerificationPort:
    return TruthScanClient(settings=settings)


def provide_paperwork_client(
    settings: Settings = Depends(provide_settings),
) -> IVendorVerificationPort:
    return PaperworkClient(settings=settings)


def provide_ai_client(
    settings: Settings = Depends(provide_settings),
) -> IAiAnalysisPort:
    return AzureOpenAIClient(settings=settings)


def provide_storage_adapter(
    settings: Settings = Depends(provide_settings),
) -> IStoragePort:
    return StorageAdapter(settings=settings)


def provide_verify_certificate_use_case(
    settings: Settings = Depends(provide_settings),
) -> VerifyCertificateUseCase:
    vendor: IVendorVerificationPort = TruthScanClient(settings=settings)
    return VerifyCertificateUseCase(vendor=vendor)
