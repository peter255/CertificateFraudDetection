from __future__ import annotations

from dataclasses import dataclass

from app.domain.enums.document_type import DocumentType
from app.domain.value_objects.certificate_id import CertificateId
from app.domain.value_objects.document_hash import DocumentHash
from app.domain.value_objects.holder_name import HolderName
from app.domain.value_objects.issuer_name import IssuerName


@dataclass(frozen=True)
class Certificate:
    """
    Aggregate root representing a submitted certificate document.

    Immutable once constructed. Business identity is carried by CertificateId.
    Document integrity is tracked through DocumentHash.
    """

    id: CertificateId
    holder_name: HolderName
    issuer_name: IssuerName
    document_hash: DocumentHash
    document_type: DocumentType
    raw_content: bytes
