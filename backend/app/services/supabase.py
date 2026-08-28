# app/services/supabase.py

import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)


def get_image(path: str) -> bytes:
    image = supabase.storage.from_("photos").download(path)
    return image