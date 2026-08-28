from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.services.diary_generator import generate_daily_diary
from app.services.gemini import analyze_images
from app.services.supabase import get_image, supabase

router = APIRouter()
BASE_DIR = Path(__file__).resolve().parent.parent


@router.get("/healthz")
def healthz():
    return {"status": "ok"}


@router.post("/upload")
async def upload_image(
    user_id: str,
    date: str,
    file: UploadFile = File(...),
):
    try:
        data = await file.read()
        storage_path = f"{user_id}/{date}/{file.filename}"
        supabase.storage.from_("photos").upload(storage_path, data, file_options={"content-type": file.content_type})
        return {
            "message": "アップロード成功",
            "storage_path": storage_path,
            "filename": file.filename,
            "size": len(data),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/images")
def list_images(user_id: str, date: str):
    try:
        prefix = f"{user_id}/{date}/"
        files = supabase.storage.from_("photos").list(path=prefix)
        return {"user_id": user_id, "date": date, "files": files}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/daily-diary")
def daily_diary(user_id: str, date: str):
    try:
        return generate_daily_diary(user_id=user_id, date=date)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
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
