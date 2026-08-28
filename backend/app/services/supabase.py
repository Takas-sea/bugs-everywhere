import os
from urllib.parse import urlparse

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

_SUPABASE_URL = os.getenv("SUPABASE_URL")
_SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")


def _normalize_supabase_url(url: str) -> str:
    if not url:
        return url
    normalized = url.rstrip("/")
    if normalized.endswith("/rest/v1"):
        return normalized[: -len("/rest/v1")]
    return normalized


def _has_valid_supabase_config() -> bool:
    if not _SUPABASE_URL or not _SUPABASE_SECRET_KEY:
        return False

    normalized_url = _normalize_supabase_url(_SUPABASE_URL)
    parsed = urlparse(normalized_url)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


supabase = None
if _has_valid_supabase_config():
    try:
        normalized_url = _normalize_supabase_url(_SUPABASE_URL)
        supabase = create_client(normalized_url, _SUPABASE_SECRET_KEY)
    except Exception:
        supabase = None


def get_image(path: str) -> bytes:
    if supabase is None:
        raise ValueError("Supabase configuration is missing or invalid. Set valid SUPABASE_URL and SUPABASE_SECRET_KEY.")

    image = supabase.storage.from_("photos").download(path)
    return image