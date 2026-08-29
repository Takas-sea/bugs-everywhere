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
    before_summary = (before_row or {}).get("summary") or "前の場面の雰囲気"
    after_summary = (after_row or {}).get("summary") or "次の場面の雰囲気"

    if before_row and after_row:
        return (
            f"{summary} "
            "この画像は、前の出来事と次の出来事の間にある時間を埋める1枚の旅行の記憶です。 "
            f"前の写真の要約: {before_summary}. "
            f"次の写真の要約: {after_summary}. "
            "前の雰囲気と次の雰囲気を自然に接続し、同じ旅の流れとして一枚の絵にしてください。 "
            "色味、時間帯、光、景色、人物の配置が前後の写真と整合するようにし、空白の時間が連続して見えるように描いてください。"
        )
    if before_row:
        return (
            f"{summary} "
            "この画像は、前の場面のあとに続く空白時間を埋めるイラストです。 "
            f"前の写真の要約: {before_summary}. "
            "前の楽しい余韻や移動の流れを保ちつつ、時間が自然に続いているような風景を描いてください。"
        )
    if after_row:
        return (
            f"{summary} "
            "この画像は、次の場面の前にある空白時間を埋めるイラストです。 "
            f"次の写真の要約: {after_summary}. "
            "次の写真へとつながる余韻のある景色を描き、前後の旅行の流れが自然に連続するようにしてください。"
        )
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
        before_summary = (before_row or {}).get("summary") or "前の写真の雰囲気"
        after_summary = (after_row or {}).get("summary") or "次の写真の雰囲気"
        gap_summary = _gap_context_summary(summary, before_row, after_row)
        gap_summary = (
            f"{gap_summary} "
            f"前の写真の要約: {before_summary}. "
            f"次の写真の要約: {after_summary}. "
            f"前後の写真の感情や時間帯・色味を自然に接続して、空白の時間を一枚の旅の記憶として描いてください。"
        )
        gap_illustration = generate_diary_illustration(summary=gap_summary, events=events)

        generated_name = f"generated_gap_{(row.get('id') or row.get('storage_path', 'gap')).replace('/', '_').replace(' ', '_')}.png"
        generated_path = f"{owner_token}/{date}/{generated_name}"
        supabase.storage.from_("photos").upload(
            generated_path,
            gap_illustration,
            file_options={"content-type": "image/png", "upsert": "true"},
        )

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


def _list_storage_names_for_trip(trip_id: str) -> set[str]:
    if supabase is None or not trip_id:
        return set()
    try:
        listing = supabase.storage.from_("photos").list(trip_id)
        return {item.get("name") for item in (listing or []) if item.get("name")}
    except Exception:
        return set()


def _list_all_storage_paths(prefix: str = "") -> list[str]:
    if supabase is None:
        return []
    try:
        listing = supabase.storage.from_("photos").list(prefix) or []
    except Exception:
        return []

    paths: list[str] = []
    for item in listing:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if not name:
            continue
        full_path = f"{prefix}/{name}".strip("/") if prefix else name
        if item.get("type") == "folder":
            paths.extend(_list_all_storage_paths(full_path))
            continue
        paths.append(full_path)
    return paths


def _prune_generated_gap_files_for_trip(trip_id: str) -> None:
    if supabase is None or not trip_id:
        return
    try:
        all_paths = _list_all_storage_paths(trip_id)
        stale_paths = [
            path for path in all_paths
            if path.split("/")[-1].startswith("generated_")
        ]
        if stale_paths:
            supabase.storage.from_("photos").remove(stale_paths)
    except Exception:
        pass


def fill_gap_scenes_for_trip(trip_id: str) -> list[dict]:
    if not trip_id or supabase is None:
        return []

    try:
        _prune_generated_gap_files_for_trip(trip_id)
        rows = supabase.table("scenes").select("*").eq("trip_id", trip_id).eq("is_gap", True).order("seq").execute()
        items = getattr(rows, "data", []) or []
        filled = []

        for row in items:
            scene_id = row["id"]
            seq = row.get("seq")
            prev = next((candidate for candidate in items if candidate.get("trip_id") == trip_id and candidate.get("seq") == seq - 1), None)
            nxt = next((candidate for candidate in items if candidate.get("trip_id") == trip_id and candidate.get("seq") == seq + 1), None)

            summary = f"{row.get('started_at', '開始')} から {row.get('ended_at', '終了')} の空白の時間を、前後の出来事から自然に補完した旅行の情景。"
            if prev and prev.get("summary"):
                summary += " 前の出来事: " + prev["summary"]
            if nxt and nxt.get("summary"):
                summary += " 次の出来事: " + nxt["summary"]
            if not prev and not nxt:
                summary = "旅行の途中で起きた想像できる一瞬を、自然な風景として補完したイメージ。"

            before_context = prev.get("summary") if prev else None
            after_context = nxt.get("summary") if nxt else None

            if before_context or after_context:
                summary = (
                    "空白の時間を埋める1枚の旅行イラストです。 "
                    f"前の写真の要約: {before_context or '不明'}。 "
                    f"次の写真の要約: {after_context or '不明'}。 "
                    "前後の写真の流れを自然につなぎ、同じ旅の記憶として一枚の景色にしてください。 "
                    "人物・空・地面・光・季節感が前後の写真と整合し、時間のつながりが自然に見えるように描いてください。"
                )
            else:
                summary = "空白の時間を埋める1枚の旅行イラストです。 前後の写真がなくても、旅の余韻を感じる自然な風景として描いてください。"

            storage_path = f"{trip_id}/generated_gap_{scene_id}.png"
            filenames = _list_storage_names_for_trip(trip_id)
            if storage_path.split("/")[-1] not in filenames:
                illustration = generate_diary_illustration(
                    summary,
                    events=[
                        before_context or '前の時間の雰囲気',
                        after_context or '次の時間の雰囲気',
                        '前後の写真に自然に続く風景',
                    ],
                )
                supabase.storage.from_("photos").upload(storage_path, illustration, file_options={"content-type": "image/png", "upsert": "true"})

            supabase.table("scenes").update({"is_gap": False, "summary": summary}).eq("id", scene_id).execute()
            supabase.table("panels").update({"image_path": storage_path, "status": "done"}).eq("scene_id", scene_id).execute()
            filled.append({"scene_id": scene_id, "trip_id": trip_id, "storage_path": storage_path, "summary": summary})

        return filled
    except Exception:
        return []


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
