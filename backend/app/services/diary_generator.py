import base64
from datetime import datetime

from fastapi import HTTPException

from app.services.gemini import analyze_images, generate_diary_illustration
from app.services.supabase import (
    get_daily_photo_paths,
    get_daily_photo_rows,
    get_image,
    supabase,
    update_photo_metadata,
)


def _effective_photo_time(row: dict) -> datetime:
    for key in ("captured_at", "created_at"):
        value = row.get(key)
        if value:
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                pass
    return datetime.min


def _gap_context_summary(summary: str, before_row: dict | None, after_row: dict | None) -> str:
    before_at = (before_row or {}).get("captured_at") or (before_row or {}).get("created_at") or "前"
    after_at = (after_row or {}).get("captured_at") or (after_row or {}).get("created_at") or "後"
    if before_row and after_row:
        return f"{summary} なお、{before_at}から{after_at}の間にあった空白の時間を、前後の情景と出来事から自然に補完した一枚の場面として描いてください。"
    if before_row:
        return f"{summary} なお、{before_at}以降に起きた空白の時間を、前の写真の流れから自然に続くイメージで描いてください。"
    if after_row:
        return f"{summary} なお、{after_at}より前の空白の時間を、後の写真の流れから自然に繋がる情景として描いてください。"
    return summary


def _fill_gap_rows(owner_token: str, date: str, ordered_rows: list[dict], summary: str, events: list[str]) -> list[dict]:
    if supabase is None:
        return ordered_rows

    filled_rows = []
    for index, row in enumerate(ordered_rows):
        storage_path = row.get("storage_path")
        if not row.get("is_gap"):
            filled_rows.append(row)
            continue

        before_row = ordered_rows[index - 1] if index > 0 else None
        after_row = ordered_rows[index + 1] if index + 1 < len(ordered_rows) else None
        gap_summary = _gap_context_summary(summary, before_row, after_row)
        gap_illustration = generate_diary_illustration(summary=gap_summary, events=events)

        generated_name = f"generated_gap_{(row.get('id') or row.get('storage_path', 'gap')).replace('/', '_').replace(' ', '_')}.png"
        generated_path = f"{owner_token}/{date}/{generated_name}"
        supabase.storage.from_("photos").upload(generated_path, gap_illustration, file_options={"content-type": "image/png"})

        update_photo_metadata(
            photo_id=row.get("id"),
            storage_path=generated_path,
            metadata={"is_gap": False, "storage_path": generated_path, "generated_from_gap": True},
            client=supabase,
        )

        row = dict(row)
        row["storage_path"] = generated_path
        row["is_gap"] = False
        row["generated_from_gap"] = True
        filled_rows.append(row)

    return filled_rows


def generate_daily_diary(owner_token: str, date: str) -> dict:
    try:
        photo_rows = get_daily_photo_rows(owner_token=owner_token, date=date)
    except Exception:
        photo_rows = [{"storage_path": path} for path in get_daily_photo_paths(owner_token=owner_token, date=date)]

    if not photo_rows:
        photo_rows = [{"storage_path": path} for path in get_daily_photo_paths(owner_token=owner_token, date=date)]

    if not photo_rows:
        raise HTTPException(status_code=404, detail=f"No images found for owner_token={owner_token}, date={date}")

    ordered_rows = sorted(photo_rows, key=_effective_photo_time)
    image_paths = [row["storage_path"] for row in ordered_rows if row.get("storage_path")]
    images = [get_image(path) for path in image_paths]
    result = analyze_images(images, image_names=image_paths)
    summary = result.get("summary", "")
    events = result.get("events") or []

    ordered_rows = _fill_gap_rows(owner_token, date, ordered_rows, summary, events)
    image_paths = [row["storage_path"] for row in ordered_rows if row.get("storage_path")]
    images = [get_image(path) for path in image_paths]

    illustration_bytes = generate_diary_illustration(summary=summary, events=events)
    illustration_base64 = base64.b64encode(illustration_bytes).decode("utf-8")

    timeline = []
    for row in ordered_rows:
        storage_path = row.get("storage_path")
        if not storage_path:
            continue
        photo_bytes = get_image(storage_path)
        timeline.append({
            "type": "photo",
            "storage_path": storage_path,
            "captured_at": row.get("captured_at") or row.get("created_at"),
            "image_base64": base64.b64encode(photo_bytes).decode("utf-8"),
            "image_mime_type": "image/jpeg",
            "is_gap": bool(row.get("is_gap")),
        })

    timeline.append({
        "type": "generated",
        "summary": summary,
        "events": events,
        "image_base64": illustration_base64,
        "image_mime_type": "image/png",
    })

    return {
        "owner_token": owner_token,
        "date": date,
        "image_count": len(images),
        "image_paths": image_paths,
        "timeline": timeline,
        "illustration_base64": illustration_base64,
        "illustration_mime_type": "image/png",
        **result,
    }
