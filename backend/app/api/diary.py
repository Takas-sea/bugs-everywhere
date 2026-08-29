import io
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from app.services.diary_generator import fill_gap_scenes_for_trip, generate_daily_diary
from app.services.gemini import analyze_images
from app.services.supabase import (
    get_daily_photo_paths,
    get_image,
    insert_photo_metadata,
    query_photo_rows_by_day,
    resolve_trip_ids_by_owner_token,
    supabase,
)

router = APIRouter()
BASE_DIR = Path(__file__).resolve().parent.parent


@router.get("/healthz")
def healthz():
    return {"status": "ok"}


@router.post("/upload")
async def upload_image(
    owner_token: str,
    date: str,
    file: UploadFile = File(...),
):
    try:
        data = await file.read()
        storage_path = f"{owner_token}/{date}/{file.filename}"
        supabase.storage.from_("photos").upload(storage_path, data, file_options={"content-type": file.content_type})

        metadata = {
            "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "storage_path": storage_path,
            "original_filename": file.filename,
            "content_type": file.content_type,
        }

        insert_photo_metadata(owner_token, metadata, client=supabase)

        for trip_id in resolve_trip_ids_by_owner_token(owner_token, client=supabase):
            fill_gap_scenes_for_trip(trip_id)

        return {
            "message": "アップロード成功",
            "owner_token": owner_token,
            "date": date,
            "storage_path": storage_path,
            "filename": file.filename,
            "size": len(data),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/images")
def list_images(owner_token: str, date: str):
    try:
        start = datetime.strptime(date, "%Y-%m-%d").strftime("%Y-%m-%dT00:00:00Z")
        end = datetime.strptime(date, "%Y-%m-%d").strftime("%Y-%m-%dT23:59:59Z")

        files = query_photo_rows_by_day(owner_token, date, select_fields="storage_path, created_at", client=supabase)
        return {"owner_token": owner_token, "date": date, "files": files}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/daily-diary")
def daily_diary(owner_token: str, date: str):
    try:
        return generate_daily_diary(owner_token=owner_token, date=date)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/download-day")
def download_day(owner_token: str, date: str):
    try:
        storage_paths = get_daily_photo_paths(owner_token=owner_token, date=date)
        if not storage_paths:
            raise HTTPException(status_code=404, detail=f"No images found for owner_token={owner_token}, date={date}")

        files = []
        for storage_path in storage_paths:
            name = storage_path.split("/")[-1]
            files.append(
                {
                    "filename": name,
                    "storage_path": storage_path,
                    "download_path": f"photos/{storage_path}",
                }
            )

        return {
            "owner_token": owner_token,
            "date": date,
            "folder": f"photos/{owner_token}/{date}/",
            "files": files,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/download-day-zip")
def download_day_zip(owner_token: str, date: str):
    try:
        storage_paths = get_daily_photo_paths(owner_token=owner_token, date=date)
        if not storage_paths:
            raise HTTPException(status_code=404, detail=f"No images found for owner_token={owner_token}, date={date}")

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for storage_path in storage_paths:
                image_bytes = get_image(storage_path)
                filename = storage_path.split("/")[-1]
                zf.writestr(filename, image_bytes)

        buffer.seek(0)
        filename = f"{owner_token}_{date}.zip"
        return StreamingResponse(
            buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/test-image")
def test_image(
    filename: str = Query(default="test.jpg", description="Supabase Storage にある画像ファイル名")
):
    try:
        image = get_image(filename)
        output_path = BASE_DIR / filename
        output_path.write_bytes(image)
        return {
            "message": "画像取得成功",
            "filename": filename,
            "size": len(image),
            "saved_path": str(output_path),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/analyze")
def analyze():
    try:
        paths = [
            "image1.jpg",
            "image2.jpg",
            "image3.jpg",
        ]

        images = [get_image(path) for path in paths]
        result = analyze_images(images)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
