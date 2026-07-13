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
        raise NotImplementedError

    async def estimate_ai_probability(
        self,
        *,
        document_content: bytes,
        filename: str,
        context: dict[str, Any],
    ) -> float | None:
        if not self.is_configured():
            return None

        endpoint = self._settings.azure_openai_endpoint.rstrip("/")
        deployment = self._settings.azure_openai_deployment.strip()
        url = (
            f"{endpoint}/openai/deployments/{deployment}/chat/completions"
            f"?api-version={_API_VERSION}"
        )

        content_type = _detect_content_type(document_content, filename)
        context_json = json.dumps(_slim_context(context), ensure_ascii=False, default=str)
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

        # gpt-5-mini rejects `max_tokens` and often rejects non-default temperature.
        payload = {
            "messages": [{"role": "user", "content": user_content}],
            "max_completion_tokens": _MAX_COMPLETION_TOKENS,
        }

        headers = {
            "api-key": self._settings.azure_openai_api_key,
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code >= 400:
                # Retry once without image if multimodal request failed.
                detail = response.text[:500]
                logger.warning(
                    "Azure OpenAI request failed (%s): %s",
                    response.status_code,
                    detail,
                )
                if len(user_content) > 1:
                    text_only = {
                        "messages": [{"role": "user", "content": [user_content[0]]}],
                        "max_completion_tokens": _MAX_COMPLETION_TOKENS,
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
                "Azure OpenAI returned an empty AI probability response. usage=%s",
                body.get("usage"),
            )
            return None

        probability = _parse_probability(message_content)
        if probability is None:
            logger.warning("Could not parse AI probability from: %s", message_content[:300])
        return probability


def _slim_context(context: dict[str, Any]) -> dict[str, Any]:
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
