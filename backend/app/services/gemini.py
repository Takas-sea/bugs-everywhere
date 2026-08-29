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


def _build_diary_prompt(summary: str, events: list[str] | None = None) -> str:
    event_text = "\n".join(f"- {event}" for event in (events or []))
    if event_text:
        event_text = f"\n関連イベント:\n{event_text}\n"
    return f"""
    あなたは旅行の絵日記を描くイラストレーターです。
    以下の1日の要約をもとに、旅行の情景を一枚の美しいイラストとして生成してください。
    - 1日の要約: {summary}
    {event_text}
    画像は、旅行の思い出を温かく、鮮やかで、印象的に表現してください。
    風景、人物、季節感、空気感が自然に感じられる構図にしてください。
    その日の雰囲気が伝わる表現にしてください。
    さらに、前景と遠景の層をはっきりさせ、空の明るさと光の変化、地面の質感、人物や建物の輪郭がはっきり見えるようにしてください。
    画面全体に視線が自然に集まり、旅の余韻が感じられる温かい雰囲気を大事にしてください。
    """.strip()


def generate_diary_illustration(summary: str, events: list[str] | None = None) -> bytes:
    if not summary:
        raise ValueError("A diary summary is required to generate an illustration.")

    try:
        from PIL import Image, ImageDraw, ImageFilter
    except Exception as exc:
        raise RuntimeError("Pillow is required to generate diary illustrations.") from exc

    width, height = 1200, 1200
    img = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    sky_top = (150, 190, 220)
    sky_bottom = (255, 198, 166)
    for y in range(height):
        ratio = y / height
        r = int(sky_top[0] * (1 - ratio) + sky_bottom[0] * ratio)
        g = int(sky_top[1] * (1 - ratio) + sky_bottom[1] * ratio)
        b = int(sky_top[2] * (1 - ratio) + sky_bottom[2] * ratio)
        draw.line((0, y, width, y), fill=(r, g, b, 255))

    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((700, 80, 1050, 430), fill=(255, 214, 120, 180))
    glow_draw.ellipse((740, 120, 1010, 390), fill=(255, 236, 170, 150))
    img = Image.alpha_composite(img, glow)

    cloud_color = (255, 255, 255, 70)
    for cx, cy, rx, ry in [(200, 230, 140, 50), (480, 205, 160, 55), (780, 250, 180, 60), (970, 180, 140, 45)]:
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=cloud_color)

    mountain_layers = [
        ((0, 620), (170, 440), (360, 650), (530, 430), (740, 680), (910, 470), (1110, 640), (1200, 760), (0, 760)),
        ((0, 720), (160, 560), (340, 740), (550, 600), (760, 760), (980, 610), (1200, 720), (1200, 860), (0, 860)),
    ]
    mountain_colors = [(64, 88, 96), (90, 112, 110)]
    for layer, color in zip(mountain_layers, mountain_colors):
        draw.polygon(layer, fill=color)

    ground = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ground_draw = ImageDraw.Draw(ground)
    ground_draw.rectangle((0, 760, width, height), fill=(107, 136, 100, 220))
    img = Image.alpha_composite(img, ground)

    path = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    path_draw = ImageDraw.Draw(path)
    path_draw.polygon([(0, 860), (350, 760), (470, 760), (620, 860), (760, 860), (860, 960), (0, 1200)], fill=(200, 176, 127, 230))
    path_draw.polygon([(620, 860), (760, 860), (980, 1200), (820, 1200)], fill=(177, 149, 101, 220))
    img = Image.alpha_composite(img, path)

    figure = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    fdraw = ImageDraw.Draw(figure)
    fdraw.ellipse((268, 700, 320, 760), fill=(77, 65, 58, 220))
    fdraw.line((294, 760, 294, 855), fill=(77, 65, 58, 220), width=8)
    fdraw.line((294, 785, 330, 830), fill=(77, 65, 58, 220), width=6)
    fdraw.line((294, 785, 256, 832), fill=(77, 65, 58, 220), width=6)
    img = Image.alpha_composite(img, figure)

    vignette = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette)
    for i in range(220, 0, -1):
        alpha = int(220 - i * 0.8)
        vdraw.ellipse((i, i, width - i, height - i), outline=(0, 0, 0, alpha), width=2)
    img = Image.alpha_composite(img, vignette)

    rgb_img = img.convert("RGB")
    rgb_img = rgb_img.filter(ImageFilter.SMOOTH)
    buffer = io.BytesIO()
    rgb_img.save(buffer, format="PNG")
    return buffer.getvalue()


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
