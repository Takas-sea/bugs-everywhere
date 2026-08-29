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
            "前後の写真を見て、同じ旅の流れとして自然につながる景色を作ってください。 "
            "色味、光、人物や建物、移動の余韻、季節感が前後の雰囲気と整合するようにし、空白の時間が自然に続いて見えるように描いてください。"
        )
    if before_row:
        return (
            f"{summary} "
            "この画像は、前の場面のあとに続く空白時間を埋めるイラストです。 "
            f"前の写真の要約: {before_summary}. "
            "前の写真の余韻と移動の流れを保ちつつ、自然に続いているような風景を描いてください。"
        )
    if after_row:
        return (
            f"{summary} "
            "この画像は、次の場面の前にある空白時間を埋めるイラストです。 "
            f"次の写真の要約: {after_summary}. "
            "次の写真へとつながる余韻のある景色を描き、前後の旅行の流れが自然に連続するようにしてください。"
        )
    return summary


def _describe_gap_from_images(before_row: dict | None, after_row: dict | None) -> tuple[str, list[str]]:
    image_bytes: list[bytes] = []
    image_names: list[str] = []

    for row in (before_row, after_row):
        if not row:
            continue
        storage_path = row.get("storage_path")
        if not storage_path:
            continue
        try:
            image_bytes.append(get_image(storage_path))
            image_names.append(storage_path)
        except Exception:
            continue

    if not image_bytes:
        fallback_before = (before_row or {}).get("summary") or "前の場面の雰囲気"
        fallback_after = (after_row or {}).get("summary") or "次の場面の雰囲気"
        return (
            f"前の場面: {fallback_before}。 次の場面: {fallback_after}。 "
            "前後の雰囲気を自然に接続する、同じ旅の記憶としての一枚の景色。",
            [fallback_before, fallback_after],
        )

    description = analyze_images(image_bytes, image_names=image_names)
    summary = description.get("summary") or "前後の写真を自然につなぐ旅の光景"
    events = description.get("events") or []
    return summary, events


def _describe_scene_from_photo_ids(scene: dict) -> tuple[str, list[str]]:
    photo_ids = scene.get("photo_ids") or []
    if not photo_ids:
        return (scene.get("summary") or "旅の記憶をまとめた一コマです。", [])

    image_bytes: list[bytes] = []
    image_names: list[str] = []
    for photo_id in photo_ids:
        try:
            rows = supabase.table("photos").select("storage_path").eq("id", photo_id).execute()
            for item in getattr(rows, "data", []) or []:
                storage_path = item.get("storage_path")
                if storage_path:
                    image_bytes.append(get_image(storage_path))
                    image_names.append(storage_path)
        except Exception:
            continue

    if not image_bytes:
        return (scene.get("summary") or "旅の記憶をまとめた一コマです。", [])

    description = analyze_images(image_bytes, image_names=image_names)
    summary = description.get("summary") or (scene.get("summary") or "旅の記憶をまとめた一コマです。")
    events = description.get("events") or []
    return summary, events


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
        gap_summary_from_images, gap_events = _describe_gap_from_images(before_row, after_row)
        before_summary = (before_row or {}).get("summary") or "前の写真の雰囲気"
        after_summary = (after_row or {}).get("summary") or "次の写真の雰囲気"
        gap_summary = _gap_context_summary(gap_summary_from_images, before_row, after_row)
        gap_summary = (
            f"{gap_summary} "
            f"前の写真の要約: {before_summary}. "
            f"次の写真の要約: {after_summary}. "
            "AIが見た前後の写真の流れをそのまま反映して、空白の時間を一枚の旅の記憶として描いてください。"
        )
        gap_illustration = generate_diary_illustration(summary=gap_summary, events=gap_events or events)

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

        try:
            scenes_response = supabase.table("scenes").select("*").eq("trip_id", trip_id).eq("is_gap", True).order("seq").execute()
            items = getattr(scenes_response, "data", []) or []
        except Exception:
            scenes_response = supabase.table("scenes").select("*").execute()
            items = getattr(scenes_response, "data", []) or []
            items = [row for row in items if str(row.get("trip_id")) == str(trip_id) and row.get("is_gap") is True]

        items = sorted(items, key=lambda row: row.get("seq") or 0)
        filled = []

        for row in items:
            scene_id = row["id"]
            seq = row.get("seq")
            prev = next((candidate for candidate in items if candidate.get("seq") == seq - 1), None)
            nxt = next((candidate for candidate in items if candidate.get("seq") == seq + 1), None)

            panel_mode = "gen"
            try:
                panel_rows = supabase.table("panels").select("*").eq("scene_id", scene_id).execute()
                panel_data = getattr(panel_rows, "data", []) or []
                panel = next((candidate for candidate in panel_data if candidate.get("scene_id") == scene_id), {})
                panel_mode = (panel or {}).get("mode") or "gen"
            except Exception:
                panel_mode = "gen"

            if panel_mode == "i2i":
                summary, _ = _describe_scene_from_photo_ids(row)
                summary = summary or (row.get("summary") or "旅の記憶をまとめた一コマです。")
                supabase.table("scenes").update({"summary": summary}).eq("id", scene_id).execute()
                supabase.table("panels").update({"image_path": None, "status": "done"}).eq("scene_id", scene_id).execute()
                filled.append({"scene_id": scene_id, "trip_id": trip_id, "summary": summary, "mode": "i2i", "status": "done"})
                continue

            before_context = prev.get("summary") if prev else None
            after_context = nxt.get("summary") if nxt else None
            gap_summary_from_images, gap_events = _describe_gap_from_images(prev, nxt)
            summary = gap_summary_from_images or "前後の旅の情景を自然につなぐ一枚のイメージ。"

            if before_context or after_context:
                prompt_summary = (
                    "空白の時間を埋める1枚の旅行イラストです。 "
                    f"前の写真の要約: {before_context or '不明'}。 "
                    f"次の写真の要約: {after_context or '不明'}。 "
                    f"AIが判断した前後の連続感: {gap_summary_from_images}。 "
                    "前後の写真の流れを自然につなぎ、同じ旅の記憶として一枚の景色にしてください。"
                )
            else:
                prompt_summary = "空白の時間を埋める1枚の旅行イラストです。 前後の写真がなくても、旅の余韻を感じる自然な風景として描いてください。"

            events = gap_events or [before_context or "前の時間の雰囲気", after_context or "次の時間の雰囲気"]
            storage_path = f"{trip_id}/generated_gap_{scene_id}.png"
            filenames = _list_storage_names_for_trip(trip_id)
            if storage_path.split("/")[-1] not in filenames:
                illustration = generate_diary_illustration(prompt_summary, events=events)
                supabase.storage.from_("photos").upload(storage_path, illustration, file_options={"content-type": "image/png", "upsert": "true"})

            supabase.table("scenes").update({"summary": summary}).eq("id", scene_id).execute()
            supabase.table("panels").update({"image_path": storage_path, "status": "done"}).eq("scene_id", scene_id).execute()
            filled.append({"scene_id": scene_id, "trip_id": trip_id, "storage_path": storage_path, "summary": summary, "mode": "gen", "status": "done"})

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
