from io import BytesIO

from fastapi import UploadFile
from fastapi.testclient import TestClient

from app.main import app
from app.services import gemini


client = TestClient(app)


def test_upload_image_tracks_owner_token_and_metadata(monkeypatch):
    uploaded = {}
    inserted = []

    class FakeTable:
        def __init__(self):
            self.payload = None

        def insert(self, payload):
            self.payload = payload
            inserted.append(payload)
            return self

        def execute(self):
            return type("Response", (), {"data": [self.payload]})()

    class FakeStorage:
        def from_(self, bucket_name):
            return self

        def upload(self, storage_path, data, file_options=None):
            uploaded["storage_path"] = storage_path
            uploaded["data"] = data
            uploaded["file_options"] = file_options
            return {"path": storage_path}

    class FakeSupabase:
        def __init__(self):
            self.storage = FakeStorage()
            self._table = FakeTable()

        def table(self, name):
            assert name == "photos"
            return self._table

    monkeypatch.setattr("app.api.diary.supabase", FakeSupabase())

    response = client.post(
        "/upload",
        params={"owner_token": "user_001", "date": "2026-08-28"},
        files={"file": ("photo1.jpg", BytesIO(b"abc"), "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["owner_token"] == "user_001"
    assert response.json()["storage_path"] == "user_001/2026-08-28/photo1.jpg"
    assert uploaded["storage_path"] == "user_001/2026-08-28/photo1.jpg"
    assert inserted[0]["owner_token"] == "user_001"
    assert inserted[0]["storage_path"] == "user_001/2026-08-28/photo1.jpg"


def test_list_images_uses_owner_token_query(monkeypatch):
    class FakeRows:
        def __init__(self, data):
            self.data = data

    class FakeTable:
        def __init__(self):
            self.queries = []

        def select(self, *_):
            self.queries.append("select")
            return self

        def eq(self, key, value):
            self.queries.append((key, value))
            return self

        def gte(self, key, value):
            self.queries.append((key, value))
            return self

        def lt(self, key, value):
            self.queries.append((key, value))
            return self

        def order(self, key):
            self.queries.append(("order", key))
            return self

        def execute(self):
            return FakeRows([
                {"storage_path": "user_001/2026-08-28/photo1.jpg", "created_at": "2026-08-28T12:00:00Z"},
                {"storage_path": "user_001/2026-08-28/photo2.jpg", "created_at": "2026-08-28T12:05:00Z"},
            ])

    class FakeSupabase:
        def table(self, name):
            assert name == "photos"
            return FakeTable()

    monkeypatch.setattr("app.api.diary.supabase", FakeSupabase())

    response = client.get("/images", params={"owner_token": "user_001", "date": "2026-08-28"})

    assert response.status_code == 200
    assert len(response.json()["files"]) == 2
    assert response.json()["files"][0]["storage_path"] == "user_001/2026-08-28/photo1.jpg"


def test_healthz():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_daily_diary(monkeypatch):
    monkeypatch.setattr("app.api.diary.generate_daily_diary", lambda owner_token, date: {
        "owner_token": owner_token,
        "date": date,
        "image_count": 2,
        "summary": "1日の出来事を要約",
        "events": ["event1", "event2"],
    })

    response = client.get("/daily-diary", params={"owner_token": "user_001", "date": "2026-08-28"})

    assert response.status_code == 200
    assert response.json()["image_count"] == 2
    assert response.json()["summary"] == "1日の出来事を要約"


def test_download_day_folder(monkeypatch):
    monkeypatch.setattr(
        "app.api.diary.get_daily_photo_paths",
        lambda owner_token, date: [
            "user_001/2026-08-28/photo1.jpg",
            "user_001/2026-08-28/photo2.jpg",
        ],
    )

    response = client.get("/download-day", params={"owner_token": "user_001", "date": "2026-08-28"})

    assert response.status_code == 200
    body = response.json()
    assert body["folder"] == "photos/user_001/2026-08-28/"
    assert body["files"][0]["storage_path"] == "user_001/2026-08-28/photo1.jpg"
    assert body["files"][0]["download_path"] == "photos/user_001/2026-08-28/photo1.jpg"


def test_download_day_zip(monkeypatch):
    monkeypatch.setattr(
        "app.api.diary.get_daily_photo_paths",
        lambda owner_token, date: [
            "user_001/2026-08-28/photo1.jpg",
            "user_001/2026-08-28/photo2.jpg",
        ],
    )
    monkeypatch.setattr("app.api.diary.get_image", lambda storage_path: b"fake-image-bytes")

    response = client.get("/download-day-zip", params={"owner_token": "user_001", "date": "2026-08-28"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/zip")
    assert response.headers["content-disposition"].startswith('attachment; filename="user_001_2026-08-28.zip"')
    assert len(response.content) > 0


def test_analyze_images_retries_on_transient_failure(monkeypatch):
    attempts = {"count": 0}

    class FakeResponse:
        text = '{"summary": "ok", "events": ["event1"]}'

    class FakeModels:
        def generate_content(self, **kwargs):
            attempts["count"] += 1
            if attempts["count"] == 1:
                raise RuntimeError("503 UNAVAILABLE")
            return FakeResponse()

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(gemini, "client", FakeClient())

    result = gemini.analyze_images([b"abc", b"def"], image_names=["a.jpg", "b.jpg"])

    assert result["summary"] == "ok"
    assert attempts["count"] == 2


def test_analyze_images_parses_markdown_json(monkeypatch):
    class FakeResponse:
        text = '```json\n{"summary": "ok", "events": ["event1"]}\n```'

    class FakeModels:
        def generate_content(self, **kwargs):
            return FakeResponse()

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(gemini, "client", FakeClient())

    result = gemini.analyze_images([b"abc"], image_names=["a.jpg"])

    assert result["summary"] == "ok"
    assert result["events"] == ["event1"]
