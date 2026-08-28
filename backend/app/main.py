from fastapi import FastAPI
from app.services.supabase import get_image

app = FastAPI()


@app.get("/test-image")
def test_image():
    image = get_image("001.jpg")

    return {
        "message": "画像を取得しました",
        "size": len(image)
    }