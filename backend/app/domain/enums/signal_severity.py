from enum import IntEnum


class SignalSeverity(IntEnum):
    """
    Ordered severity scale for an individual verification signal.

    Integer backing enables sorting and threshold comparisons without
    additional helper functions.
    """

    INFO = 1
    WARNING = 2
    CRITICAL = 3
