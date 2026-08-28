import os
from datetime import datetime
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


def get_daily_photo_paths(owner_token: str, date: str) -> list[str]:
    if supabase is None:
        raise ValueError("Supabase configuration is missing or invalid. Set valid SUPABASE_URL and SUPABASE_SECRET_KEY.")

    start = datetime.strptime(date, "%Y-%m-%d").strftime("%Y-%m-%dT00:00:00Z")
    end = datetime.strptime(date, "%Y-%m-%d").strftime("%Y-%m-%dT23:59:59Z")

    last_error = None
    for field in ("owner_token", "trip_id"):
        try:
            rows = (
                supabase.table("photos")
                .select("storage_path")
                .gte("created_at", start)
                .lt("created_at", end)
                .eq(field, owner_token)
                .order("created_at")
                .execute()
            )
            data = getattr(rows, "data", []) or []
            return [row["storage_path"] for row in data if row.get("storage_path")]
        except Exception as exc:
            last_error = exc
            if "does not exist" not in str(exc):
                raise

    raise last_error


def get_image(path: str) -> bytes:
    if supabase is None:
        raise ValueError("Supabase configuration is missing or invalid. Set valid SUPABASE_URL and SUPABASE_SECRET_KEY.")

    image = supabase.storage.from_("photos").download(path)
    return image