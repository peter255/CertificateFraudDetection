from enum import StrEnum


class VerificationStatus(StrEnum):
    AUTHENTIC = "authentic"
    FRAUDULENT = "fraudulent"
    INCONCLUSIVE = "inconclusive"
    PENDING = "pending"
