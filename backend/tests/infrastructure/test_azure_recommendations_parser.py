import json

from app.infrastructure.ai.azure_openai.azure_openai_client import _parse_recommendations


def test_parse_recommendations_accepts_valid_payload() -> None:
    raw = json.dumps(
        {
            "recommendations": [
                {
                    "recommendation": "Verify award date against issuer records.",
                    "description": "The PDF creation date postdates the certificate award date.",
                }
            ]
        }
    )
    parsed = _parse_recommendations(raw)
    assert parsed == [
        {
            "recommendation": "Verify award date against issuer records.",
            "description": "The PDF creation date postdates the certificate award date.",
        }
    ]


def test_parse_recommendations_rejects_decision_enums() -> None:
    raw = json.dumps(
        {
            "recommendations": [
                {
                    "recommendation": "manual_review",
                    "description": "Needs review.",
                }
            ]
        }
    )
    assert _parse_recommendations(raw) is None
