from pydantic import BaseModel, Field


class VerifyCertificateRequest(BaseModel):
    """
    Input DTO for the certificate verification use case.

    document_content carries the raw bytes of the uploaded file.
    All fields are required; the use case rejects incomplete submissions.
    """

    document_content: bytes = Field(..., description="Raw binary content of the certificate file.")
    document_type: str = Field(..., description="Semantic category of the document being verified.")
    holder_name: str = Field(..., min_length=1, description="Full name of the certificate holder.")
    issuer_name: str = Field(..., min_length=1, description="Name of the authority that issued the certificate.")
