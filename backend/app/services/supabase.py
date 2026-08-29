import os
import uuid
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
    normalized_owner_token = _coerce_to_uuid(owner_token)
    lookup_values = [normalized_owner_token] if normalized_owner_token else []
    if owner_token and owner_token not in lookup_values:
        lookup_values.append(owner_token)

    last_error = None
    for field in _photo_lookup_fields():
        for value in lookup_values:
            if value is None:
                continue
            try:
                rows = (
                    client.table("photos")
                    .select(select_fields)
                    .gte("created_at", start)
                    .lt("created_at", end)
                    .eq(field, value)
                    .order("created_at")
                    .execute()
                )
                data = getattr(rows, "data", []) or []
                if data:
                    return data
            except Exception as exc:
                last_error = exc
                if not _schema_mismatch_error(exc):
                    raise

    try:
        rows = (
            client.table("photos")
            .select(select_fields)
            .gte("created_at", start)
            .lt("created_at", end)
            .order("created_at")
            .execute()
        )
        data = getattr(rows, "data", []) or []
        if data:
            return data
    except Exception as exc:
        last_error = exc
        if not _schema_mismatch_error(exc):
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


def resolve_trip_ids_by_owner_token(owner_token: str, client=None) -> list[str]:
    client = client or supabase
    if not owner_token:
        return []
    if client is None:
        return [owner_token]

    normalized_owner_token = _coerce_to_uuid(owner_token)
    lookup_values = [normalized_owner_token] if normalized_owner_token else []
    if owner_token and owner_token not in lookup_values:
        lookup_values.append(owner_token)
    for value in lookup_values:
        if value is None:
            continue
        try:
            table = client.table("trips")
            if not hasattr(table, "select") or not hasattr(table, "eq"):
                return [owner_token]
            rows = table.select("id").eq("owner_token", value).execute()
            trip_ids = [row.get("id") for row in getattr(rows, "data", []) or [] if row.get("id")]
            if trip_ids:
                return trip_ids
        except Exception as exc:
            if not _schema_mismatch_error(exc):
                return [owner_token]

    return []


def _schema_mismatch_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return (
        "does not exist" in msg
        or "could not find the" in msg
        or "column" in msg
        or "invalid input syntax for type uuid" in msg
        or ("uuid" in msg and "owner_token" in msg)
    )


def _coerce_to_uuid(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return str(uuid.UUID(text))
    except (ValueError, TypeError, AttributeError):
        return str(uuid.uuid5(uuid.NAMESPACE_URL, text))


def _drop_unsupported_schema_fields(payload: dict) -> dict:
    unsupported = {
        "content_type",
        "summary",
        "events",
        "generated_from_gap",
        "original_filename",
        "owner_token",
        "trip_id",
    }
    return {k: v for k, v in payload.items() if k not in unsupported}


def insert_photo_metadata(owner_token: str, metadata: dict, client=None) -> dict:
    client = client or supabase
    if client is None:
        raise ValueError("Supabase configuration is missing or invalid. Set valid SUPABASE_URL and SUPABASE_SECRET_KEY.")

    normalized_owner_token = _coerce_to_uuid(owner_token)
    safe_metadata = _drop_unsupported_schema_fields(dict(metadata or {}))
    payload_variants = [
        {**safe_metadata, "owner_token": normalized_owner_token},
        {"owner_token": normalized_owner_token},
        safe_metadata,
        {},
    ]

    last_error = None
    for payload in payload_variants:
        try:
            result = client.table("photos").insert(payload).execute()
            return getattr(result, "data", [payload])[0]
        except Exception as exc:
            last_error = exc
            if not _schema_mismatch_error(exc):
                raise
            continue

    if last_error is not None and _schema_mismatch_error(last_error):
        return {"owner_token": normalized_owner_token, **safe_metadata}

    if last_error is not None:
        raise last_error

    return {"owner_token": normalized_owner_token, **safe_metadata}


def update_photo_metadata(photo_id: str | None = None, storage_path: str | None = None, metadata: dict | None = None, client=None) -> dict:
    client = client or supabase
    if client is None:
        raise ValueError("Supabase configuration is missing or invalid. Set valid SUPABASE_URL and SUPABASE_SECRET_KEY.")

    payload = dict(metadata or {})
    if storage_path is not None:
        payload["storage_path"] = storage_path

    if not photo_id and not storage_path:
        raise ValueError("Either photo_id or storage_path is required to update a photo row.")

    supported_candidates = [
        {k: v for k, v in payload.items() if k not in {"generated_from_gap"}},
        {k: v for k, v in payload.items() if k not in {"generated_from_gap", "storage_path"}},
        payload,
    ]

    last_error = None
    for candidate in supported_candidates:
        if not candidate:
            continue
        query = client.table("photos").update(candidate)
        if photo_id:
            query = query.eq("id", photo_id)
        elif storage_path:
            query = query.eq("storage_path", storage_path)
        try:
            result = query.execute()
            return getattr(result, "data", [candidate])[0]
        except Exception as exc:
            last_error = exc
            msg = str(exc).lower()
            if "does not exist" not in msg and "could not find the" not in msg and "column" not in msg:
                raise
            stripped = _drop_unsupported_schema_fields(candidate)
            if not stripped:
                continue
            fallback = client.table("photos").update(stripped)
            if photo_id:
                fallback = fallback.eq("id", photo_id)
            elif storage_path:
                fallback = fallback.eq("storage_path", storage_path)
            try:
                result = fallback.execute()
                return getattr(result, "data", [stripped])[0]
            except Exception:
                continue

    if last_error is not None and _schema_mismatch_error(last_error):
        return payload

    if last_error is not None:
        raise last_error

    return payload


def get_image(path: str) -> bytes:
    if supabase is None:
        raise ValueError("Supabase configuration is missing or invalid. Set valid SUPABASE_URL and SUPABASE_SECRET_KEY.")
    if not path:
        raise ValueError("Supabase image path is empty.")

    image = supabase.storage.from_("photos").download(path)
    return image