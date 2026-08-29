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


def _photo_lookup_fields() -> tuple[str, ...]:
    return ("trip_id", "owner_token")


def query_photo_rows_by_day(owner_token: str, date: str, select_fields: str = "storage_path, created_at", client=None):
    client = client or supabase
    if client is None:
        raise ValueError("Supabase configuration is missing or invalid. Set valid SUPABASE_URL and SUPABASE_SECRET_KEY.")

    start = datetime.strptime(date, "%Y-%m-%d").strftime("%Y-%m-%dT00:00:00Z")
    end = datetime.strptime(date, "%Y-%m-%d").strftime("%Y-%m-%dT23:59:59Z")

    last_error = None
    for field in _photo_lookup_fields():
        try:
            rows = (
                client.table("photos")
                .select(select_fields)
                .gte("created_at", start)
                .lt("created_at", end)
                .eq(field, owner_token)
                .order("created_at")
                .execute()
            )
            data = getattr(rows, "data", []) or []
            if data:
                return data
        except Exception as exc:
            last_error = exc
            if "does not exist" not in str(exc):
                raise

    if last_error is not None:
        raise last_error

    return []


def get_daily_photo_rows(owner_token: str, date: str) -> list[dict]:
    rows = query_photo_rows_by_day(owner_token, date, select_fields="storage_path, created_at, captured_at")
    return [row for row in rows if row.get("storage_path")]


def get_daily_photo_paths(owner_token: str, date: str) -> list[str]:
    rows = get_daily_photo_rows(owner_token, date)
    return [row["storage_path"] for row in rows if row.get("storage_path")]


def insert_photo_metadata(owner_token: str, metadata: dict, client=None) -> dict:
    client = client or supabase
    if client is None:
        raise ValueError("Supabase configuration is missing or invalid. Set valid SUPABASE_URL and SUPABASE_SECRET_KEY.")

    last_error = None
    for candidate_fields in (
        ["owner_token", "trip_id"],
        ["trip_id"],
        ["owner_token"],
    ):
        try:
            payload = dict(metadata)
            for field in candidate_fields:
                payload[field] = owner_token
            result = client.table("photos").insert(payload).execute()
            return getattr(result, "data", [payload])[0]
        except Exception as exc:
            last_error = exc
            if "does not exist" not in str(exc):
                raise

    raise last_error


def update_photo_metadata(photo_id: str | None = None, storage_path: str | None = None, metadata: dict | None = None, client=None) -> dict:
    client = client or supabase
    if client is None:
        raise ValueError("Supabase configuration is missing or invalid. Set valid SUPABASE_URL and SUPABASE_SECRET_KEY.")

    payload = dict(metadata or {})
    if storage_path is not None:
        payload["storage_path"] = storage_path

    if not photo_id and not storage_path:
        raise ValueError("Either photo_id or storage_path is required to update a photo row.")

    query = client.table("photos").update(payload)
    if photo_id:
        query = query.eq("id", photo_id)
    elif storage_path:
        query = query.eq("storage_path", storage_path)
    result = query.execute()
    return getattr(result, "data", [payload])[0]


def get_image(path: str) -> bytes:
    if supabase is None:
        raise ValueError("Supabase configuration is missing or invalid. Set valid SUPABASE_URL and SUPABASE_SECRET_KEY.")
    if not path:
        raise ValueError("Supabase image path is empty.")

    image = supabase.storage.from_("photos").download(path)
    return image