import io
import json
import os
import re
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

_api_key = os.getenv("GEMINI_API_KEY")
_model_name = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
client = None
if _api_key:
    try:
        client = genai.Client(api_key=_api_key)
    except Exception:
        client = None


def _mime_type_from_name(name: str | None) -> str:
    lowered = (name or "").lower()
    if lowered.endswith(".png"):
        return "image/png"
    if lowered.endswith(".webp"):
        return "image/webp"
    if lowered.endswith(".heic") or lowered.endswith(".heif"):
        return "image/heic"
    return "image/jpeg"


def _normalize_image_for_gemini(image: bytes, name: str | None = None) -> tuple[bytes, str]:
    mime_type = _mime_type_from_name(name)

    if mime_type in {"image/heic", "image/heif"}:
        try:
            from PIL import Image

            image_obj = Image.open(io.BytesIO(image))
            if image_obj.mode not in {"RGB", "RGBA"}:
                image_obj = image_obj.convert("RGB")
            output = io.BytesIO()
            image_obj.save(output, format="JPEG")
            return output.getvalue(), "image/jpeg"
        except Exception:
            return image, mime_type

    return image, mime_type


def _parse_json_response(text: str) -> dict:
    if text is None:
        raise ValueError("Gemini response did not include text content.")

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = re.sub(r"^json\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start : end + 1]

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Gemini JSON parse failed: {text}") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Gemini response was not a JSON object.")

    return parsed


def analyze_images(images: list[bytes], image_names: list[str] | None = None) -> dict:
    if not images:
        raise ValueError("At least one image is required for analysis.")
    if client is None:
        raise ValueError("Gemini API key is missing or invalid. Set a valid GEMINI_API_KEY.")

    prompt = types.Part.from_text(
        text="""
        以下の複数の写真は、同じ1日の出来事を撮影したものです。

        写真をまとめて分析し、その日の出来事を要約してください。

        以下のJSON形式だけで回答してください。

        {
          "summary": "1日の出来事を1〜3文で要約",
          "events": [
            "出来事1",
            "出来事2",
            "出来事3"
          ]
        }

        写真から明確に判断できないことは推測しないでください。
        """
    )

    image_parts = []
    for index, image in enumerate(images):
        name = (image_names or [None] * len(images))[index] if image_names else None
        normalized_bytes, mime_type = _normalize_image_for_gemini(image, name)
        image_parts.append(types.Part.from_bytes(data=normalized_bytes, mime_type=mime_type))

    last_error = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=_model_name,
                contents=[prompt, *image_parts],
            )

            text = getattr(response, "text", None)
            if text is None:
                candidates = getattr(response, "candidates", None) or []
                if candidates:
                    parts = getattr(candidates[0].content, "parts", []) or []
                    for part in parts:
                        if getattr(part, "text", None):
                            text = part.text
                            break

            return _parse_json_response(text)
        except Exception as exc:
            last_error = exc
            message = str(exc).lower()
            if "503" not in message and "unavailable" not in message and "429" not in message and "rate limit" not in message and "json parse failed" not in message:
                raise
            if attempt < 2:
                time.sleep(2 ** attempt)
                continue

    raise last_error
