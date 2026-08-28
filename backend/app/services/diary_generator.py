from fastapi import HTTPException

from app.services.gemini import analyze_images
from app.services.supabase import get_image, get_daily_photo_paths, supabase


def generate_daily_diary(owner_token: str, date: str) -> dict:
    image_paths = get_daily_photo_paths(owner_token=owner_token, date=date)

    if not image_paths:
        raise HTTPException(status_code=404, detail=f"No images found for owner_token={owner_token}, date={date}")

    images = [get_image(path) for path in image_paths]
    result = analyze_images(images, image_names=image_paths)

    return {
        "owner_token": owner_token,
        "date": date,
        "image_count": len(images),
        "image_paths": image_paths,
        **result,
    }
