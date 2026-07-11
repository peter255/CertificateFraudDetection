from enum import StrEnum


class RecommendationType(StrEnum):
    APPROVE = "approve"
    REJECT = "reject"
    MANUAL_REVIEW = "manual_review"
