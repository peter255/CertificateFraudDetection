from enum import IntEnum


class RiskLevel(IntEnum):
    """
    Ordered severity scale for a verification session's overall risk.

    Integer backing enables direct comparison: RiskLevel.HIGH > RiskLevel.LOW.
    """

    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4
