import base64
import hashlib
import io
import json
import os
import re
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types as genai_types

load_dotenv()

_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
_model_name = os.getenv("GEMINI_CHAT_MODEL", "gemini-3.6-flash")
_image_model_name = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3.6-flash")
client = None
if _api_key:
    try:
        client = genai.Client(api_key=_api_key)
    except Exception:
        client = None


def _extract_generated_image_bytes(response) -> bytes | None:
    if response is None:
        return None

    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            inline_data = getattr(part, "inline_data", None)
            if inline_data is not None:
                payload = getattr(inline_data, "data", None)
                if isinstance(payload, (bytes, bytearray)):
                    return bytes(payload)
                if isinstance(payload, str):
                    try:
                        return base64.b64decode(payload)
                    except Exception:
                        return payload.encode("utf-8")

            image = getattr(part, "image", None)
            if image is not None:
                payload = getattr(image, "image_bytes", None)
                if payload:
                    return bytes(payload)
                payload = getattr(image, "data", None)
                if isinstance(payload, (bytes, bytearray)):
                    return bytes(payload)
                if isinstance(payload, str):
                    try:
                        return base64.b64decode(payload)
                    except Exception:
                        return payload.encode("utf-8")

    if hasattr(response, "inline_data"):
        payload = getattr(response.inline_data, "data", None)
        if isinstance(payload, (bytes, bytearray)):
            return bytes(payload)
        if isinstance(payload, str):
            try:
                return base64.b64decode(payload)
            except Exception:
                return payload.encode("utf-8")

    return None


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


def write_gap_text(before_summary: str | None, after_summary: str | None) -> str:
    before = before_summary or "前の時間の雰囲気"
    after = after_summary or "次の時間の雰囲気"
    return (
        "空白の時間を埋める1枚の旅行イラストです。 "
        f"前の場面: {before}。 "
        f"次の場面: {after}。 "
        "前後の写真的な流れを自然につなぎ、同じ旅の記憶として一枚の景色にしてください。 "
        "時間の経過が自然に見えるように、光、空、立ち止まる余韻、人物や風景が続いている感じを出してください。"
    )


def generate_image(summary: str, events: list[str] | None = None) -> bytes:
    return generate_diary_illustration(summary=summary, events=events)


def _infer_scene_theme(summary: str) -> str:
    text = (summary or "").lower()
    indicators = {
        "temple": ["寺", "神社", "仏閣", "境内", "参拝", "門", "鳥居", "大仏", "境内"],
        "beach": ["海", "海辺", "浜辺", "波", "サーフ", "砂浜", "海岸", "夕日", "潮"],
        "city": ["駅", "街", "都市", "夜景", "ビル", "百貨店", "商店", "港町", "都会"],
        "mountain": ["山", "登山", "渓谷", "尾根", "高原", "峠", "山道", "森", "森林"],
        "village": ["村", "田舎", "集落", "農家", "田んぼ", "畑", "古い町", "小さな街"],
        "cafe": ["カフェ", "喫茶", "ランチ", "食事", "朝ごはん", "レストラン", "店", "屋台", "テラス"],
    }
    scores = {name: 0 for name in indicators}
    for name, keywords in indicators.items():
        for keyword in keywords:
            if keyword in text:
                scores[name] += 2
    if not any(scores.values()):
        return "travel"
    return max(scores, key=scores.get)


def generate_diary_illustration(summary: str, events: list[str] | None = None) -> bytes:
    if not summary:
        raise ValueError("A diary summary is required to generate an illustration.")

    prompt = (
        "あなたは旅行の絵日記を描くイラストレーターです。 "
        "以下の要約を元に、1枚の自然で温かい旅の風景のイラストを作成してください。 "
        f"- 1日の要約: {summary} "
        + (f"関連イベント: {', '.join(events or [])}." if events else "")
        + " 背景は深みのある自然の景色にし、前景に人物や建物の輪郭がはっきり見えるようにしてください。 "
        "見た目は美しい旅行の記憶として、色味と構図が安定していて、印象に残る表現にしてください。"
    )

    if client is not None:
        try:
            response = client.models.generate_content(
                model=_image_model_name,
                contents=prompt,
                config=genai_types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
            )
            image_bytes = _extract_generated_image_bytes(response)
            if image_bytes:
                return image_bytes
        except Exception:
            pass

    try:
        from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
    except Exception as exc:
        raise RuntimeError("Pillow is required to generate diary illustrations.") from exc

    theme = _infer_scene_theme(summary)
    seed = int(hashlib.sha256(summary.encode("utf-8")).hexdigest()[:8], 16)

    palettes = {
        "temple": {"sky_top": (18, 28, 42), "sky_bottom": (124, 170, 188), "ground": (132, 116, 90), "hill": (154, 170, 122), "hill2": (119, 145, 111), "path": (189, 160, 125), "roof": (146, 103, 76), "building": (182, 167, 146)},
        "beach": {"sky_top": (12, 29, 52), "sky_bottom": (255, 175, 118), "ground": (150, 177, 127), "hill": (95, 146, 127), "hill2": (65, 119, 126), "path": (214, 181, 118), "roof": (77, 106, 137), "building": (123, 164, 196)},
        "city": {"sky_top": (18, 24, 45), "sky_bottom": (120, 127, 180), "ground": (83, 101, 109), "hill": (98, 110, 130), "hill2": (66, 84, 107), "path": (164, 149, 128), "roof": (76, 82, 118), "building": (138, 150, 167)},
        "mountain": {"sky_top": (12, 26, 44), "sky_bottom": (117, 145, 176), "ground": (102, 118, 89), "hill": (85, 127, 108), "hill2": (60, 90, 78), "path": (166, 138, 90), "roof": (96, 117, 99), "building": (126, 136, 122)},
        "village": {"sky_top": (24, 37, 48), "sky_bottom": (202, 160, 120), "ground": (145, 149, 104), "hill": (124, 138, 95), "hill2": (92, 111, 84), "path": (185, 160, 124), "roof": (122, 92, 72), "building": (172, 150, 122)},
        "cafe": {"sky_top": (25, 34, 52), "sky_bottom": (242, 181, 148), "ground": (122, 116, 100), "hill": (142, 129, 110), "hill2": (109, 104, 92), "path": (195, 176, 146), "roof": (136, 82, 60), "building": (174, 164, 149)},
        "travel": {"sky_top": (17, 29, 46), "sky_bottom": (202, 176, 147), "ground": (125, 128, 104), "hill": (131, 145, 118), "hill2": (89, 113, 112), "path": (188, 160, 117), "roof": (126, 94, 72), "building": (166, 158, 143)},
    }
    palette = palettes.get(theme, palettes["travel"])
    width, height = 1200, 1200

    def gradient_layer(top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
        layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        for y in range(height):
            ratio = y / height
            draw.line((0, y, width, y), fill=(
                int(top[0] * (1 - ratio) + bottom[0] * ratio),
                int(top[1] * (1 - ratio) + bottom[1] * ratio),
                int(top[2] * (1 - ratio) + bottom[2] * ratio),
                255,
            ))
        return layer

    def glow_layer(x: int, y: int, r: int, color: tuple[int, int, int, int]) -> Image.Image:
        layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)
        draw.ellipse((x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7), fill=(color[0], color[1], color[2], color[3] // 2))
        return layer

    def build_hills() -> Image.Image:
        layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        draw.polygon([(0, 760), (120, 700), (250, 760), (420, 650), (590, 760), (740, 680), (930, 760), (1100, 650), (1200, 760), (1200, 1200), (0, 1200)], fill=palette["hill"])
        draw.polygon([(0, 860), (180, 760), (330, 860), (540, 730), (760, 860), (920, 780), (1200, 860), (1200, 1200), (0, 1200)], fill=palette["hill2"])
        return layer

    def build_ground() -> Image.Image:
        layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        draw.rectangle((0, 820, width, height), fill=palette["ground"])

        if theme in {"temple", "cafe", "city", "village"}:
            for x in range(80, width, 120):
                building_h = 140 + ((seed + x) % 120)
                draw.rectangle((x, 760 - building_h, x + 70, 820), fill=palette["building"])
                draw.rectangle((x + 16, 720 - building_h, x + 54, 760 - building_h + 18), fill=(240, 220, 175, 200))
        elif theme in {"beach", "travel"}:
            for x in range(50, width, 120):
                draw.ellipse((x, 720, x + 100, 930), fill=(82 + (seed % 12), 131 + (seed % 18), 121, 160))
        else:
            for x in range(80, width, 90):
                draw.ellipse((x, 700, x + 90, 980), fill=(45 + (seed % 18), 90 + (seed % 12), 66 + (seed % 10), 150))
        return layer

    def build_path() -> Image.Image:
        layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        if theme == "beach":
            draw.polygon([(0, 980), (220, 900), (420, 900), (620, 980), (780, 980), (980, 1070), (1200, 980), (1200, 1200), (0, 1200)], fill=(220, 201, 156, 220))
        else:
            draw.polygon([(0, 1030), (360, 900), (620, 920), (820, 1000), (990, 980), (1200, 1030), (1200, 1200), (0, 1200)], fill=palette["path"])
        return layer

    def build_detail_layers() -> Image.Image:
        layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)

        if theme == "temple":
            center_x = 600
            for i, h in enumerate([200, 170, 160]):
                x0 = center_x - 230 + i * 90
                x1 = center_x + 230 - i * 90
                draw.polygon([(x0, 700 - h), (center_x, 600 - h), (x1, 700 - h), (x1, 700), (x0, 700)], fill=palette["roof"])
            draw.rectangle((540, 700, 660, 890), fill=(138, 117, 96, 180))
            draw.rectangle((580, 740, 620, 880), fill=(255, 220, 160, 180))
        elif theme == "beach":
            draw.rectangle((0, 660, width, 820), fill=(75, 126, 153, 180))
            draw.arc((180, 540, 1000, 900), start=180, end=360, fill=(255, 228, 184, 120), width=16)
        elif theme == "city":
            for x in range(70, width, 110):
                h = 190 + ((seed + x) % 100)
                draw.rectangle((x, 820 - h, x + 80, 820), fill=(90 + (seed % 25), 98 + (seed % 15), 117 + (seed % 10), 200))
                draw.rectangle((x + 12, 820 - h + 20, x + 35, 820), fill=(255, 218, 162, 220))
        elif theme == "mountain":
            draw.polygon([(0, 820), (150, 650), (280, 790), (450, 630), (620, 820), (820, 670), (960, 820), (1200, 720), (1200, 1200), (0, 1200)], fill=(66, 92, 90, 220))

        if theme in {"temple", "city", "cafe", "village"}:
            for x in [260, 480, 740, 940]:
                draw.ellipse((x, 760, x + 42, 820), fill=(56, 51, 46, 220))
                draw.line((x + 20, 820, x + 10, 910), fill=(56, 51, 46, 220), width=8)
                draw.line((x + 20, 840, x + 52, 890), fill=(56, 51, 46, 220), width=6)
                draw.line((x + 20, 840, x - 18, 892), fill=(56, 51, 46, 220), width=6)
        else:
            draw.ellipse((320, 770, 370, 830), fill=(60, 55, 48, 210))
            draw.ellipse((860, 750, 910, 810), fill=(60, 55, 48, 210))
            draw.line((345, 830, 345, 930), fill=(60, 55, 48, 210), width=7)
            draw.line((885, 810, 885, 910), fill=(60, 55, 48, 210), width=7)

        for i in range(200):
            x = (seed + i * 97) % width
            y = (seed * 13 + i * 53) % height
            draw.ellipse((x, y, x + 2, y + 2), fill=(255, 255, 255, 12 + (i % 20)))

        return layer

    img = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    img = Image.alpha_composite(img, gradient_layer(palette["sky_top"], palette["sky_bottom"]))
    img = Image.alpha_composite(img, glow_layer(880 + (seed % 180), 180 + ((seed >> 2) % 140), 120 + (seed % 40), (255, 216, 136, 180)))
    for x, y, r, s in [(150, 220, 200, 60), (430, 180, 210, 65), (760, 230, 180, 55), (990, 180, 170, 50)]:
        img = Image.alpha_composite(img, glow_layer(x, y, r, (255, 255, 255, 50 + (seed % 30))))
        img = Image.alpha_composite(img, glow_layer(x + 10, y + 8, int(r * 0.75), (255, 255, 255, 25 + (seed % 18))))

    img = Image.alpha_composite(img, build_hills())
    img = Image.alpha_composite(img, build_ground())
    img = Image.alpha_composite(img, build_path())
    img = Image.alpha_composite(img, build_detail_layers())

    vignette = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette)
    for i in range(250, 0, -1):
        alpha = int(250 - i * 0.9)
        vdraw.ellipse((i, i, width - i, height - i), outline=(0, 0, 0, alpha), width=2)
    img = Image.alpha_composite(img, vignette)

    img = ImageEnhance.Color(img).enhance(1.12)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = img.filter(ImageFilter.SMOOTH_MORE)

    buffer = io.BytesIO()
    img.convert("RGB").save(buffer, format="PNG")
    return buffer.getvalue()


def analyze_images(images: list[bytes], image_names: list[str] | None = None) -> dict:
    if not images:
        raise ValueError("At least one image is required for analysis.")
    if client is None:
        raise ValueError("Gemini API key is missing or invalid. Set a valid GEMINI_API_KEY.")

    image_parts = []
    for index, image in enumerate(images):
        normalized_bytes, _ = _normalize_image_for_gemini(image, (image_names or [None] * len(images))[index] if image_names else None)
        image_parts.append({
            "inline_data": {
                "mime_type": "image/jpeg",
                "data": base64.b64encode(normalized_bytes).decode("ascii"),
            }
        })

    prompt = """
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

    last_error = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=_model_name,
                contents=[{
                    "role": "user",
                    "parts": [{"text": prompt}, *image_parts],
                }],
                config=genai_types.GenerateContentConfig(response_mime_type="application/json"),
            )
            text = getattr(response, "text", None)
            if not text:
                for candidate in getattr(response, "candidates", []) or []:
                    for part in getattr(getattr(candidate, "content", None), "parts", []) or []:
                        if getattr(part, "text", None):
                            text = part.text
                            break
                    if text:
                        break
            if not text:
                raise ValueError("Gemini response did not include text content.")
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
