import hashlib
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
_image_model_name = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")
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


def generate_diary_illustration(summary: str, events: list[str] | None = None) -> bytes:
    """空白の時間の絵を作る。

    まず Gemini の画像生成モデルに描かせます。失敗したとき（クォータ切れ、
    ネットワーク、モデルが使えないなど）は、下の _draw_placeholder_illustration
    で簡易的な風景を描いて返します。絵が無いとコマが空になってしまうため、
    ここでは例外を投げずに必ず何かを返します。
    """
    if not summary:
        raise ValueError("A diary summary is required to generate an illustration.")

    if client is not None:
        try:
            return _generate_illustration_with_gemini(summary, events)
        except Exception as exc:
            print("画像生成エラー（代替の絵を使います）:", repr(exc))

    return _draw_placeholder_illustration(summary)


def _generate_illustration_with_gemini(
    summary: str, events: list[str] | None = None
) -> bytes:
    """Gemini に絵を描かせる。失敗したら例外を投げる。"""
    import base64

    hints = "、".join([e for e in (events or []) if e])[:200]
    prompt = (
        "旅の絵日記に載せる、やわらかい水彩風のイラストを1枚描いてください。"
        "写真が残っていない時間帯を想像で補う挿絵です。"
        "文字は入れないでください。人物の顔は描き込まないでください。"
        f"場面: {summary}"
    )
    if hints:
        prompt += f" 手がかり: {hints}"

    interaction = client.interactions.create(
        model=_image_model_name,
        input=prompt,
    )

    data = getattr(getattr(interaction, "output_image", None), "data", None)
    if not data:
        raise RuntimeError("画像が返ってきませんでした")

    return base64.b64decode(data)


def _draw_placeholder_illustration(summary: str) -> bytes:
    try:
        from PIL import Image, ImageDraw, ImageFilter
    except Exception as exc:
        raise RuntimeError("Pillow is required to generate diary illustrations.") from exc

    normalized = re.sub(r"[^0-9A-Za-zぁ-んァ-ン一-龥]+", " ", summary)
    token_values = [ord(ch) for ch in normalized if ch.strip()]
    seed = int(hashlib.sha256(summary.encode("utf-8")).hexdigest()[:8], 16)
    mood_seed = sum(token_values) % 7
    sky_top = [
        (15, 26, 55),
        (145, 120, 180),
        (150, 190, 220),
        (120, 140, 160),
        (80, 110, 150),
        (160, 170, 210),
        (120, 95, 140),
    ][mood_seed % 7]
    sky_bottom = [
        (53, 78, 123),
        (255, 181, 112),
        (255, 198, 166),
        (188, 154, 120),
        (120, 145, 170),
        (224, 204, 180),
        (200, 155, 135),
    ][mood_seed % 7]

    width, height = 1200, 1200
    img = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    for y in range(height):
        ratio = y / height
        r = int(sky_top[0] * (1 - ratio) + sky_bottom[0] * ratio)
        g = int(sky_top[1] * (1 - ratio) + sky_bottom[1] * ratio)
        b = int(sky_top[2] * (1 - ratio) + sky_bottom[2] * ratio)
        draw.line((0, y, width, y), fill=(r, g, b, 255))

    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_size = 240 + ((seed >> 4) % 140)
    glow_x = 700 + ((seed >> 2) % 180)
    glow_y = 60 + ((seed >> 6) % 80)
    glow_draw.ellipse((glow_x, glow_y, glow_x + glow_size, glow_y + glow_size * 0.7), fill=(255, 214, 120, 180))
    glow_draw.ellipse((glow_x + 30, glow_y + 20, glow_x + glow_size - 30, glow_y + glow_size * 0.7 - 20), fill=(255, 236, 170, 150))
    img = Image.alpha_composite(img, glow)

    cloud_color = (255, 255, 255, 60 + (seed % 30))
    for cx, cy, rx, ry in [(200, 230, 140, 50), (480, 205, 160, 55), (780, 250, 180, 60), (970, 180, 140, 45)]:
        draw.ellipse((cx - rx + (seed % 12), cy - ry + (seed % 9), cx + rx + (seed % 12), cy + ry + (seed % 9)), fill=cloud_color)

    landscape_bias = (seed % 5)
    if landscape_bias in (0, 3):
        mountain_layers = [
            ((0, 620), (170, 440), (360, 650), (530, 430), (740, 680), (910, 470), (1110, 640), (1200, 760), (0, 760)),
            ((0, 720), (160, 560), (340, 740), (550, 600), (760, 760), (980, 610), (1200, 720), (1200, 860), (0, 860)),
        ]
        mountain_colors = [(64 + (seed % 30), 88 + (seed % 20), 96), (90 + (seed % 20), 112 + (seed % 18), 110)]
        for layer, color in zip(mountain_layers, mountain_colors):
            draw.polygon(layer, fill=color)

    ground = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ground_draw = ImageDraw.Draw(ground)
    if landscape_bias in (1, 2):
        ground_draw.rectangle((0, 760, width, height), fill=(88 + (seed % 15), 124 + (seed % 15), 146, 200))
        for x in range(0, width, 80):
            ground_draw.arc((x, 800, x + 120, 940), start=180, end=360, fill=(150 + (seed % 30), 200 + (seed % 20), 220, 170), width=4)
        ground_draw.ellipse((200 + (seed % 180), 780, 1000 - (seed % 120), 1120), fill=(255, 190, 110, 90))
    else:
        ground_draw.rectangle((0, 760, width, height), fill=(101 + (seed % 20), 132 + (seed % 15), 96 + (seed % 18), 220))
        for x in range(0, width, 90):
            ground_draw.ellipse((x, 700, x + 64, 930), fill=(54 + (seed % 18), 95 + (seed % 20), 70 + (seed % 10), 160))
    img = Image.alpha_composite(img, ground)

    path = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    path_draw = ImageDraw.Draw(path)
    path_draw.polygon([(0, 860), (350, 760), (470, 760), (620, 860), (760, 860), (860, 960), (0, 1200)], fill=(200 + (seed % 25), 176, 127, 230))
    path_draw.polygon([(620, 860), (760, 860), (980, 1200), (820, 1200)], fill=(177 + (seed % 18), 149, 101, 220))
    img = Image.alpha_composite(img, path)

    if landscape_bias in (0, 4):
        skyline = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        sdraw = ImageDraw.Draw(skyline)
        for x in range(100, 1100, 120):
            building_h = 180 + ((seed + x) % 120)
            sdraw.rectangle((x, 760 - building_h, x + 70 + (seed % 10), 760), fill=(110 + (seed % 20), 120, 136, 180))
            sdraw.rectangle((x + 18, 720 - building_h, x + 52, 760 - building_h + 30), fill=(220, 205, 165, 220))
        img = Image.alpha_composite(img, skyline)

    if landscape_bias in (1, 5):
        blossom = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        bdraw = ImageDraw.Draw(blossom)
        for x in range(80, width - 120, 100):
            for y in range(180, 520, 80):
                bdraw.ellipse((x + (seed % 8), y, x + 28 + (seed % 10), y + 28), fill=(255, 180 + (seed % 20), 205, 200))
        img = Image.alpha_composite(img, blossom)

    figure = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    fdraw = ImageDraw.Draw(figure)
    figure_x = 220 + (seed % 170)
    fdraw.ellipse((figure_x, 700, figure_x + 52, 760), fill=(77, 65, 58, 220))
    fdraw.line((figure_x + 26, 760, figure_x + 26, 855), fill=(77, 65, 58, 220), width=8)
    fdraw.line((figure_x + 26, 785, figure_x + 62, 830), fill=(77, 65, 58, 220), width=6)
    fdraw.line((figure_x + 26, 785, figure_x - 12, 832), fill=(77, 65, 58, 220), width=6)
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


NEWLINE = "\n"


def analyze_images(
    images: list[bytes],
    image_names: list[str] | None = None,
    context: str | None = None,
) -> dict:
    if not images:
        raise ValueError("At least one image is required for analysis.")
    if client is None:
        raise ValueError("Gemini API key is missing or invalid. Set a valid GEMINI_API_KEY.")

    hint = f"{NEWLINE}参考情報（写真から読み取れない補足です）:{NEWLINE}{context}" if context else ""

    prompt = types.Part.from_text(
        text=f"""
        これは旅の絵日記の一コマです。以下の写真は同じ場面で撮られたものです。

        写っているものをよく見て、その場面の日記の文章を書いてください。

        書き方の指示:
        ・2〜3文。実際に日記に書くような、具体的で情景が浮かぶ文章にしてください。
        ・写真に写っているもの（建物、food、空の色、人の様子など）に必ず触れてください。
        ・「大切な瞬間」「かけがえのない時間」のような、どの写真にも当てはまる
        　抽象的な表現は使わないでください。
        ・写真から判断できないことは書かないでください。
        {hint}

        以下のJSON形式だけで回答してください。

        {{
          "summary": "この場面の日記の文章（2〜3文）",
          "events": [
            "写真から読み取れた具体的な要素1",
            "要素2",
            "要素3"
          ]
        }}
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
