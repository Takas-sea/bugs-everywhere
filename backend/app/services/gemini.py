import base64
import json
import os

from google import genai

_api_key = os.getenv("GEMINI_API_KEY")
client = None
if _api_key:
    try:
        client = genai.Client(api_key=_api_key)
    except Exception:
        client = None


def analyze_images(images: list[bytes]) -> dict:
    if not images:
        raise ValueError("At least one image is required for analysis.")
    if client is None:
        raise ValueError("Gemini API key is missing or invalid. Set a valid GEMINI_API_KEY.")

    contents = [
        """
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
    ]

    for image in images:
        contents.append({
            "mime_type": "image/jpeg",
            "data": base64.b64encode(image).decode("utf-8"),
        })

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=contents,
    )

    text = getattr(response, "text", None)
    if text is None:
        raise ValueError("Gemini response did not include text content.")

    return json.loads(text)