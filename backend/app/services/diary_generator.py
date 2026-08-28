from fastapi import HTTPException

from app.services.gemini import analyze_images
from app.services.supabase import get_image, supabase


def generate_daily_diary(user_id: str, date: str) -> dict:
    prefix = f"{user_id}/{date}/"
    entries = supabase.storage.from_("photos").list(path=prefix)

    image_paths = []
    for entry in entries:
        if isinstance(entry, dict):
            name = entry.get("name")
        else:
            name = getattr(entry, "name", None)

        if not name:
            continue
        image_paths.append(f"{user_id}/{date}/{name}")

    if not image_paths:
        raise HTTPException(status_code=404, detail=f"No images found for user_id={user_id}, date={date}")

    images = [get_image(path) for path in image_paths]
    result = analyze_images(images)

    return {
        "user_id": user_id,
        "date": date,
        "image_count": len(images),
        "image_paths": image_paths,
        **result,
    }
