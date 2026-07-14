from __future__ import annotations

import base64
import json
import re
from typing import Any

import httpx

from app.domain.entities.certificate import Certificate
from app.domain.entities.verification_report import VendorFinding
from app.infrastructure.configuration.settings import Settings
from app.shared.logging.logger import get_logger

logger = get_logger(__name__)

# gpt-5-mini / newer Azure deployments need a recent preview API version.
_API_VERSION = "2024-12-01-preview"
_MAX_CONTEXT_CHARS = 8_000
# Reasoning models spend a large share of the budget on hidden reasoning tokens.
_MAX_COMPLETION_TOKENS = 2_000
# Summary needs headroom after reasoning — 2k was entirely consumed by reasoning_tokens.
_MAX_SUMMARY_COMPLETION_TOKENS = 8_000


class AzureOpenAIClient:
    """
    Adapter that satisfies IAiAnalysisPort by calling the Azure OpenAI chat completions endpoint.

    Prompt construction, token management, and response parsing live here.
    This class must remain free of domain logic; it only speaks the Azure OpenAI wire protocol
    and maps the completion text to the values the application layer expects.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def is_configured(self) -> bool:
        return bool(
            self._settings.azure_openai_api_key.strip()
            and self._settings.azure_openai_endpoint.strip()
            and self._settings.azure_openai_deployment.strip()
        )

    async def analyze(self, certificate: Certificate, findings: tuple[VendorFinding, ...]) -> str:
        context: dict[str, Any] = {
            "document_type": str(certificate.document_type),
            "findings": [
                {
                    "vendor": str(f.vendor),
                    "status": str(f.status),
                    "confidence_score": f.confidence_score,
                    "raw_response": f.raw_response,
                }
                for f in findings
            ],
        }
        summary = await self.generate_summary(context=context)
        return summary or ""

    async def generate_summary(self, *, context: dict[str, Any]) -> str | None:
        if not self.is_configured():
            return None

        context_json = json.dumps(_slim_summary_context(context), ensure_ascii=False, default=str)
        if len(context_json) > _MAX_CONTEXT_CHARS:
            context_json = context_json[:_MAX_CONTEXT_CHARS] + "…"

        prompt = (
            "Write a forensic executive summary as JSON only:\n"
            '{"summary":"<paragraph>"}\n'
            "Rules: include EVERY item in detected_flags; describe findings only; "
            "never recommend approve/reject/manual review/next steps; do not invent flags.\n"
            f"Context:\n{context_json}"
        )

        message_content = await self._chat_completion(
            prompt,
            max_completion_tokens=_MAX_SUMMARY_COMPLETION_TOKENS,
            reasoning_effort="low",
        )
        if not message_content:
            return None

        summary = _parse_summary(message_content)
        if summary is None:
            logger.warning("Could not parse executive summary from: %s", message_content[:300])
            return None
        if _looks_like_recommendation(summary):
            logger.warning("Azure summary looked like a recommendation; discarding.")
            return None
        return summary

    async def estimate_ai_probability(
        self,
        *,
        document_content: bytes,
        filename: str,
        context: dict[str, Any],
    ) -> float | None:
        if not self.is_configured():
            return None

        content_type = _detect_content_type(document_content, filename)
        context_json = json.dumps(_slim_probability_context(context), ensure_ascii=False, default=str)
        if len(context_json) > _MAX_CONTEXT_CHARS:
            context_json = context_json[:_MAX_CONTEXT_CHARS] + "…"

        prompt = (
            "You are a forensic document analyst estimating AI-generation involvement.\n"
            "Return ONLY valid JSON with this exact shape:\n"
            '{"ai_probability": <number 0-100>, "reasoning": "<one short sentence>"}\n\n'
            "Rules:\n"
            "- ai_probability is the estimated percentage (0–100) that AI tools were used "
            "to generate or materially alter the document.\n"
            "- Base the estimate on visual/textual artifacts, metadata hints, and any "
            "verification signals provided.\n"
            "- Do NOT treat fraud or authenticity verdicts as direct AI probability.\n"
            "- Use one decimal place when helpful.\n"
            f"\nVerification context:\n{context_json}"
        )

        user_content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
        # Prefer text-context estimation. Large images often fail or blow the token budget
        # on gpt-5-mini; context from vendors is enough for a numeric estimate.
        if content_type == "application/pdf":
            user_content[0]["text"] += (
                "\n\nNote: the uploaded file is a PDF. You cannot see the pixels directly; "
                "rely on the verification context and typical PDF AI-generation indicators."
            )
        elif content_type in {"image/png", "image/jpeg"} and len(document_content) <= 1_500_000:
            encoded = base64.b64encode(document_content).decode("ascii")
            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{content_type};base64,{encoded}"},
                }
            )

        message_content = await self._chat_completion_multimodal(user_content)
        if not message_content:
            return None

        probability = _parse_probability(message_content)
        if probability is None:
            logger.warning("Could not parse AI probability from: %s", message_content[:300])
        return probability

    async def _chat_completion(
        self,
        prompt: str,
        *,
        max_completion_tokens: int = _MAX_COMPLETION_TOKENS,
        reasoning_effort: str | None = None,
    ) -> str | None:
        user_content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
        return await self._chat_completion_multimodal(
            user_content,
            max_completion_tokens=max_completion_tokens,
            reasoning_effort=reasoning_effort,
        )

    async def _chat_completion_multimodal(
        self,
        user_content: list[dict[str, Any]],
        *,
        max_completion_tokens: int = _MAX_COMPLETION_TOKENS,
        reasoning_effort: str | None = None,
    ) -> str | None:
        endpoint = self._settings.azure_openai_endpoint.rstrip("/")
        deployment = self._settings.azure_openai_deployment.strip()
        url = (
            f"{endpoint}/openai/deployments/{deployment}/chat/completions"
            f"?api-version={_API_VERSION}"
        )

        # gpt-5-mini rejects `max_tokens` and often rejects non-default temperature.
        payload: dict[str, Any] = {
            "messages": [{"role": "user", "content": user_content}],
            "max_completion_tokens": max_completion_tokens,
        }
        if reasoning_effort:
            payload["reasoning_effort"] = reasoning_effort

        headers = {
            "api-key": self._settings.azure_openai_api_key,
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code >= 400 and reasoning_effort:
                # Older deployments may reject reasoning_effort — retry without it.
                logger.warning(
                    "Azure OpenAI request failed with reasoning_effort (%s): %s",
                    response.status_code,
                    response.text[:300],
                )
                payload.pop("reasoning_effort", None)
                response = await client.post(url, headers=headers, json=payload)

            if response.status_code >= 400:
                detail = response.text[:500]
                logger.warning(
                    "Azure OpenAI request failed (%s): %s",
                    response.status_code,
                    detail,
                )
                if len(user_content) > 1:
                    text_only = {
                        "messages": [{"role": "user", "content": [user_content[0]]}],
                        "max_completion_tokens": max_completion_tokens,
                    }
                    response = await client.post(url, headers=headers, json=text_only)
                    if response.status_code >= 400:
                        logger.warning(
                            "Azure OpenAI text-only retry failed (%s): %s",
                            response.status_code,
                            response.text[:500],
                        )
                        response.raise_for_status()
                else:
                    response.raise_for_status()

            body = response.json()

        message_content = (
            body.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        if not isinstance(message_content, str) or not message_content.strip():
            logger.warning(
                "Azure OpenAI returned an empty response. usage=%s",
                body.get("usage"),
            )
            return None
        return message_content


def _slim_summary_context(context: dict[str, Any]) -> dict[str, Any]:
    """Pass only flag-oriented fields — never recommendation / executive_summary."""
    slim: dict[str, Any] = {}
    for key in (
        "engine",
        "verdict",
        "overall_status",
        "final_result",
        "fraud_types",
        "fraud_score",
        "risk_level",
        "detected_flags",
        "signals",
        "ml_label",
        "ml_score",
        "ocr_label",
        "ocr_score",
        "key_indicators",
        "visual_patterns",
        "metadata_notes",
        "reasoning",
        "raw_score",
        "llm_findings",
        "provenance",
        "document_type",
        "findings",
    ):
        if key in context and context[key] not in (None, "", [], {}):
            slim[key] = context[key]
    return slim


def _slim_probability_context(context: dict[str, Any]) -> dict[str, Any]:
    """Keep only compact fields so reasoning models stay within budget."""
    slim: dict[str, Any] = {}
    for key in (
        "engine",
        "verdict",
        "fraud_types",
        "fraud_score",
        "executive_summary",
        "final_result",
        "overall_status",
        "raw_score",
        "ml_label",
        "ml_score",
        "ocr_label",
        "ocr_score",
        "key_indicators",
        "visual_patterns",
        "metadata_notes",
        "reasoning",
    ):
        if key in context and context[key] not in (None, "", [], {}):
            slim[key] = context[key]

    signals = context.get("signals")
    if isinstance(signals, list):
        slim["signals"] = signals[:8]

    layer_details = context.get("layer_details")
    if isinstance(layer_details, dict):
        c2pa = layer_details.get("c2pa")
        if isinstance(c2pa, dict):
            meta = c2pa.get("metadata") if isinstance(c2pa.get("metadata"), dict) else c2pa
            if isinstance(meta, dict):
                slim["c2pa"] = {
                    k: meta.get(k)
                    for k in ("ai_generated", "ai_indicators", "generator", "claim_generator")
                    if meta.get(k) is not None
                }
        png_ai = layer_details.get("png_ai_metadata")
        if png_ai:
            slim["png_ai_metadata"] = png_ai
        llm_report = layer_details.get("llm_report")
        if isinstance(llm_report, dict):
            slim["llm_report"] = {
                k: llm_report.get(k)
                for k in ("executive_summary", "ai_generated", "model_confidence", "confidence")
                if llm_report.get(k) is not None
            }

    return slim


def _looks_like_recommendation(text: str) -> bool:
    lowered = text.lower()
    markers = (
        "manual review",
        "recommend",
        "approve",
        "reject",
        "next step",
        "suggested action",
        "should be reviewed",
        "requires review",
        "review is required",
    )
    return any(marker in lowered for marker in markers)


def _parse_summary(raw: str) -> str | None:
    text = raw.strip()
    try:
        payload = json.loads(text)
        if isinstance(payload, dict):
            for key in ("summary", "executive_summary", "ai_summary"):
                value = payload.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
    except json.JSONDecodeError:
        pass

    match = re.search(r'"summary"\s*:\s*"((?:\\.|[^"\\])*)"', text)
    if match:
        try:
            return json.loads(f'"{match.group(1)}"').strip()
        except json.JSONDecodeError:
            cleaned = match.group(1).replace('\\"', '"').strip()
            if cleaned:
                return cleaned

    # Fallback: treat whole reply as summary if it looks like prose (not JSON).
    if text and not text.startswith("{") and len(text) > 40:
        return text
    return None


def _parse_probability(raw: str) -> float | None:
    text = raw.strip()
    try:
        payload = json.loads(text)
        if isinstance(payload, dict):
            for key in ("ai_probability", "probability", "aiProbability"):
                if key in payload:
                    return _clamp_probability(payload[key])
    except json.JSONDecodeError:
        pass

    match = re.search(r'"ai_probability"\s*:\s*([0-9]+(?:\.[0-9]+)?)', text)
    if match:
        return _clamp_probability(match.group(1))

    match = re.search(r"\b([0-9]{1,3}(?:\.[0-9]+)?)\s*%?\b", text)
    if match:
        return _clamp_probability(match.group(1))

    return None


def _clamp_probability(raw: Any) -> float | None:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if not (0 <= value <= 100):
        return None
    return round(value, 1)


def _detect_content_type(content: bytes, filename: str) -> str:
    if content[:4] == b"%PDF":
        return "application/pdf"
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if content[:2] == b"\xff\xd8":
        return "image/jpeg"

    lowered = filename.lower()
    if lowered.endswith(".pdf"):
        return "application/pdf"
    if lowered.endswith(".png"):
        return "image/png"
    if lowered.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    return "application/octet-stream"
