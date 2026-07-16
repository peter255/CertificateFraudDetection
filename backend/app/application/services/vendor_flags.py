"""Collect vendor flags exactly as returned — no rephrasing or omission."""

from __future__ import annotations

from typing import Any, Mapping


def _as_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out


def collect_vendor_flags_v2(response: Mapping[str, Any]) -> list[str]:
    """Preserve Engine V2 fraud types, risk factors, and signal flags verbatim."""
    flags: list[str] = []
    seen: set[str] = set()

    def push(value: str | None) -> None:
        if not value:
            return
        key = value.strip().lower()
        if not key or key in seen:
            return
        seen.add(key)
        flags.append(value.strip())

    fraud_types = response.get("fraud_types")
    if isinstance(fraud_types, list):
        for item in fraud_types:
            if isinstance(item, str):
                push(item)

    fraud = response.get("fraud")
    if isinstance(fraud, Mapping):
        for item in _as_str_list(fraud.get("types")):
            push(item)

    layer_details = response.get("layer_details")
    if isinstance(layer_details, Mapping):
        llm_report = layer_details.get("llm_report")
        if isinstance(llm_report, Mapping):
            for factor in _as_str_list(llm_report.get("risk_factors")):
                push(factor)

    for signal in response.get("signals") or []:
        if not isinstance(signal, Mapping):
            continue
        for key in ("fraud_type", "description", "check", "detector_label"):
            value = signal.get(key)
            if isinstance(value, str):
                push(value)

    for item in response.get("field_evidence") or []:
        if not isinstance(item, Mapping):
            continue
        for key in ("fraud_type", "description", "check", "field_label"):
            value = item.get(key)
            if isinstance(value, str):
                push(value)

    return flags


def collect_vendor_flags_v1(analysis: Mapping[str, Any]) -> list[str]:
    """Preserve Engine V1 indicators and metadata notes verbatim."""
    flags: list[str] = []
    seen: set[str] = set()

    def push(value: str | None) -> None:
        if not value:
            return
        key = value.strip().lower()
        if not key or key in seen:
            return
        seen.add(key)
        flags.append(value.strip())

    for item in _as_str_list(analysis.get("key_indicators")):
        push(item)
    for item in _as_str_list(analysis.get("visual_patterns")):
        push(item)
    for item in _as_str_list(analysis.get("metadata_notes")):
        push(item)

    return flags
