import base64
from io import BytesIO

from fastapi import UploadFile
from fastapi.testclient import TestClient

from app.main import app
from app.services import gemini
from app.services.supabase import _coerce_to_uuid


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
    assert inserted[0]["owner_token"] == _coerce_to_uuid("user_001")
    assert inserted[0]["storage_path"] == "user_001/2026-08-28/photo1.jpg"


def test_upload_image_analyzes_uploaded_photo_immediately(monkeypatch):
    prior_update = {}

    class FakeTable:
        def __init__(self):
            self.payload = None
            self._eq_key = None
            self._eq_value = None

        def insert(self, payload):
            self.payload = payload
            return self

        def update(self, payload):
            self.payload = payload
            prior_update["payload"] = payload
            return self

        def eq(self, key, value):
            self._eq_key = key
            self._eq_value = value
            return self

        def execute(self):
            if self._eq_key == "id":
                return type("Response", (), {"data": [{"id": self._eq_value, "summary": "寺院で鹿を見た", "events": ["鹿を見た"]}]})()
            return type("Response", (), {"data": [{"id": "photo-123", "storage_path": "user_001/2026-08-28/photo1.jpg"}]})()

    class FakeStorage:
        def from_(self, bucket_name):
            return self

        def upload(self, storage_path, data, file_options=None):
            return {"path": storage_path}

    class FakeSupabase:
        def __init__(self):
            self.storage = FakeStorage()
            self._table = FakeTable()

        def table(self, name):
            assert name in {"photos", "trips"}
            return self._table

    monkeypatch.setattr("app.api.diary.supabase", FakeSupabase())
    monkeypatch.setattr("app.api.diary.resolve_trip_ids_by_owner_token", lambda owner_token, client=None: [])
    monkeypatch.setattr("app.api.diary.analyze_images", lambda images, image_names=None: {"summary": "寺院で鹿を見た", "events": ["鹿を見た"]})

    response = client.post(
        "/upload",
        params={"owner_token": "user_001", "date": "2026-08-28"},
        files={"file": ("photo1.jpg", BytesIO(b"abc"), "image/jpeg")},
    )

    assert response.status_code == 200
    assert prior_update["payload"]["summary"] == "寺院で鹿を見た"
    assert prior_update["payload"]["events"] == ["鹿を見た"]


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


def test_upload_image_starts_gap_completion_immediately(monkeypatch):
    uploaded = {}
    triggered = []

    class FakeTable:
        def __init__(self):
            self.payload = None

        def insert(self, payload):
            self.payload = payload
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
            assert name in {"photos", "trips"}
            return self._table

    monkeypatch.setattr("app.api.diary.supabase", FakeSupabase())
    monkeypatch.setattr("app.api.diary.resolve_trip_ids_by_owner_token", lambda owner_token, client=None: ["trip_123"])
    monkeypatch.setattr("app.api.diary.fill_gap_scenes_for_trip", lambda trip_id: triggered.append(trip_id))

    response = client.post(
        "/upload",
        params={"owner_token": "user_001", "date": "2026-08-28"},
        files={"file": ("photo1.jpg", BytesIO(b"abc"), "image/jpeg")},
    )

    assert response.status_code == 200
    assert triggered == ["trip_123"]


def test_generate_daily_diary_includes_illustration(monkeypatch):
    monkeypatch.setattr("app.services.diary_generator.get_daily_photo_paths", lambda owner_token, date: [
        "user_001/2026-08-28/photo1.jpg",
        "user_001/2026-08-28/photo2.jpg",
    ])
    monkeypatch.setattr("app.services.diary_generator.get_image", lambda path: b"fake-image")
    monkeypatch.setattr("app.services.diary_generator.analyze_images", lambda images, image_names=None: {
        "summary": "寺院を訪れた",
        "events": ["桜を見た", "鹿を見た"],
    })
    monkeypatch.setattr("app.services.diary_generator.generate_diary_illustration", lambda summary, events=None: b"illustration-bytes")

    result = __import__("app.services.diary_generator", fromlist=["generate_daily_diary"]).generate_daily_diary("user_001", "2026-08-28")

    assert result["summary"] == "寺院を訪れた"
    assert result["illustration_base64"].startswith("aWxsdXN0cmF0aW9uLWJ5dGVz")
    assert result["timeline"][0]["description"] == "寺院を訪れた"
    assert result["timeline"][-1]["description"] == "寺院を訪れた"


def test_generate_daily_diary_fills_gap_rows_and_clears_flag(monkeypatch):
    rows = [
        {"id": "row-1", "storage_path": "user_001/2026-08-28/early.jpg", "captured_at": "2026-08-28T09:00:00Z", "created_at": "2026-08-28T09:00:00Z", "is_gap": False},
        {"id": "row-gap", "storage_path": "user_001/2026-08-28/gap-placeholder.jpg", "captured_at": "2026-08-28T11:00:00Z", "created_at": "2026-08-28T11:00:00Z", "is_gap": True},
        {"id": "row-2", "storage_path": "user_001/2026-08-28/late.jpg", "captured_at": "2026-08-28T13:00:00Z", "created_at": "2026-08-28T13:00:00Z", "is_gap": False},
    ]
    uploaded = {}
    updated = {}

    class FakeStorage:
        def from_(self, bucket_name):
            return self

        def list(self, folder):
            return []

        def remove(self, paths):
            uploaded["removed_paths"] = paths
            return True

        def upload(self, storage_path, data, file_options=None):
            uploaded["storage_path"] = storage_path
            uploaded["data"] = data
            uploaded["file_options"] = file_options
            return {"path": storage_path}

    class FakeTable:
        def __init__(self):
            self.payload = None

        def update(self, payload):
            self.payload = payload
            updated.update(payload)
            return self

        def eq(self, key, value):
            updated["eq_key"] = key
            updated["eq_value"] = value
            return self

        def execute(self):
            return type("Response", (), {"data": [self.payload]})()

    class FakeSupabase:
        def __init__(self):
            self.storage = FakeStorage()
            self._table = FakeTable()

        def table(self, name):
            assert name == "photos"
            return self._table

    monkeypatch.setattr("app.services.diary_generator.get_daily_photo_rows", lambda owner_token, date: rows)
    monkeypatch.setattr("app.services.diary_generator.get_image", lambda path: b"fake-image")
    monkeypatch.setattr("app.services.diary_generator.analyze_images", lambda images, image_names=None: {
        "summary": "山道を歩いた",
        "events": ["朝の散歩", "夕方の景色"],
    })
    monkeypatch.setattr("app.services.diary_generator.generate_diary_illustration", lambda summary, events=None: b"generated-gap-image")
    monkeypatch.setattr("app.services.diary_generator.supabase", FakeSupabase())

    result = __import__("app.services.diary_generator", fromlist=["generate_daily_diary"]).generate_daily_diary("user_001", "2026-08-28")

    assert result["timeline"][1]["type"] == "photo"
    assert result["timeline"][1]["storage_path"] == "user_001/2026-08-28/generated_gap_row-gap.png"
    assert updated["is_gap"] is False
    assert uploaded["storage_path"] == "user_001/2026-08-28/generated_gap_row-gap.png"


def test_fill_gap_scenes_for_trip_removes_stale_generated_files(monkeypatch):
    removed = {}

    class FakeStorage:
        def from_(self, bucket_name):
            return self

        def list(self, folder):
            return [
                {"name": "generated_gap_old.png"},
                {"name": "keep.png"},
            ]

        def remove(self, paths):
            removed["paths"] = paths
            return True

        def upload(self, storage_path, data, file_options=None):
            return {"path": storage_path}

    class FakeScenesTable:
        def select(self, *_):
            return self

        def eq(self, *_):
            return self

        def order(self, *_):
            return self

        def update(self, payload):
            self.payload = payload
            return self

        def execute(self):
            return type("Response", (), {"data": [{"id": "scene-1", "trip_id": "trip-1", "seq": 1, "is_gap": True, "summary": "山道の途中"}]})()

    class FakePanelsTable:
        def update(self, payload):
            self.payload = payload
            return self

        def eq(self, *_):
            return self

        def execute(self):
            return type("Response", (), {"data": []})()

    class FakeSupabase:
        def __init__(self):
            self.storage = FakeStorage()
            self._scenes = FakeScenesTable()
            self._panels = FakePanelsTable()

        def table(self, name):
            if name == "scenes":
                return self._scenes
            if name == "panels":
                return self._panels
            raise AssertionError(name)

    monkeypatch.setattr("app.services.diary_generator.supabase", FakeSupabase())
    monkeypatch.setattr("app.services.diary_generator.generate_diary_illustration", lambda summary, events=None: b"generated-gap-image")

    result = __import__("app.services.diary_generator", fromlist=["fill_gap_scenes_for_trip"]).fill_gap_scenes_for_trip("trip-1")

    assert result and result[0]["scene_id"] == "scene-1"
    assert removed["paths"] == ["trip-1/generated_gap_old.png"]


def test_generate_daily_diary_orders_photos_and_appends_generated_scene(monkeypatch):
    monkeypatch.setattr(
        "app.services.diary_generator.get_daily_photo_rows",
        lambda owner_token, date: [
            {"storage_path": "user_001/2026-08-28/late.jpg", "captured_at": "2026-08-28T13:00:00Z", "created_at": "2026-08-28T13:00:00Z"},
            {"storage_path": "user_001/2026-08-28/early.jpg", "captured_at": "2026-08-28T09:00:00Z", "created_at": "2026-08-28T09:00:00Z"},
        ],
    )
    monkeypatch.setattr("app.services.diary_generator.get_image", lambda path: b"fake-image")
    monkeypatch.setattr("app.services.diary_generator.analyze_images", lambda images, image_names=None: {
        "summary": "寺院から山道を歩いた",
        "events": ["早朝の寺院", "午後の散歩"],
    })
    monkeypatch.setattr("app.services.diary_generator.generate_diary_illustration", lambda summary, events=None: b"generated-scene")

    result = __import__("app.services.diary_generator", fromlist=["generate_daily_diary"]).generate_daily_diary("user_001", "2026-08-28")

    assert result["timeline"][0]["type"] == "photo"
    assert result["timeline"][0]["storage_path"] == "user_001/2026-08-28/early.jpg"
    assert result["timeline"][-1]["type"] == "generated"
    assert result["timeline"][-1]["image_base64"].startswith("Z2VuZXJhdGVkLXNjZW5l")


def test_gap_scene_uses_before_after_photo_context_in_prompt(monkeypatch):
    recorded = {}

    def fake_analyze_images(images, image_names=None):
        recorded["images_seen"] = len(images)
        recorded["image_names"] = image_names
        return {"summary": "海辺の夕方に歩いたあと、港町の夜道へ続く", "events": ["海辺を散歩", "夕焼けを眺めた", "港町へ移動した"]}

    def fake_generate_diary_illustration(summary, events=None, **kwargs):
        recorded["summary"] = summary
        return b"context-scene"

    monkeypatch.setattr("app.services.diary_generator.get_image", lambda path: b"photo-bytes")
    monkeypatch.setattr("app.services.diary_generator.analyze_images", fake_analyze_images)
    monkeypatch.setattr("app.services.diary_generator.generate_diary_illustration", fake_generate_diary_illustration)
    class FakeStorage:
        def from_(self, bucket_name):
            return self

        def upload(self, storage_path, data, file_options=None):
            return {"path": storage_path}

    class FakeTable:
        def update(self, payload):
            self.payload = payload
            return self

        def eq(self, key, value):
            self.key = key
            self.value = value
            return self

        def execute(self):
            return type("Response", (), {"data": [self.payload]})()

    class FakeSupabase:
        def __init__(self):
            self.storage = FakeStorage()
            self._table = FakeTable()

        def table(self, name):
            assert name == "photos"
            return self._table

    monkeypatch.setattr("app.services.diary_generator.supabase", FakeSupabase())
    rows = [
        {"id": "before", "storage_path": "trip_1/early.jpg", "captured_at": "2026-08-28T09:00:00Z", "created_at": "2026-08-28T09:00:00Z", "summary": "海辺の夕方に歩いた", "is_gap": False},
        {"id": "gap", "storage_path": "trip_1/gap.jpg", "captured_at": "2026-08-28T12:00:00Z", "created_at": "2026-08-28T12:00:00Z", "is_gap": True},
        {"id": "after", "storage_path": "trip_1/late.jpg", "captured_at": "2026-08-28T15:00:00Z", "created_at": "2026-08-28T15:00:00Z", "summary": "灯りが点る港町を散策した", "is_gap": False},
    ]

    result = __import__("app.services.diary_generator", fromlist=["_fill_gap_rows"])._fill_gap_rows(
        "owner_1", "2026-08-28", rows, "海と山の旅だった", ["海辺を散歩", " 夕焼けを眺めた"]
    )

    assert result[1]["is_gap"] is False
    assert recorded["images_seen"] == 2
    assert recorded["image_names"] == ["trip_1/early.jpg", "trip_1/late.jpg"]
    assert "前の写真" in recorded["summary"]
    assert "次の写真" in recorded["summary"]
    assert "海辺の夕方に歩いたあと" in recorded["summary"]
    assert "港町" in recorded["summary"]


def test_fill_gap_scenes_for_trip_respects_mode_and_keeps_is_gap(monkeypatch):
    scene_updates = []
    panel_updates = []

    def fake_generate_diary_illustration(summary, events=None, **kwargs):
        return b"generated-illustration"

    def fake_analyze_images(images, image_names=None):
        return {"summary": "東大寺の朝。鹿がのんびり歩いていて、思ったより人が少なかった。", "events": ["朝の散歩", "鹿を見た"]}

    class FakeSceneTable:
        def __init__(self):
            self.rows = [{
                "id": "scene-1",
                "trip_id": "trip-1",
                "seq": 3,
                "is_gap": True,
                "photo_ids": ["trip-1/photo-3.jpg"],
                "summary": "旧プロンプト",
            }]
            self._eq = None

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self._eq = (key, value)
            return self

        def order(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self._eq == ("trip_id", "trip-1") or self._eq == ("is_gap", True):
                return type("Resp", (), {"data": self.rows})()
            return type("Resp", (), {"data": []})()

        def update(self, payload):
            scene_updates.append(payload)
            return self

    class FakePanelTable:
        def __init__(self):
            self.rows = [{"id": "panel-1", "scene_id": "scene-1", "mode": "i2i", "status": "pending", "image_path": None}]
            self._eq = None

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self._eq = (key, value)
            return self

        def order(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self._eq == ("scene_id", "scene-1"):
                return type("Resp", (), {"data": self.rows})()
            return type("Resp", (), {"data": []})()

        def update(self, payload):
            panel_updates.append(payload)
            return self

    class FakePhotosTable:
        def __init__(self):
            self.rows = [{"id": "trip-1/photo-3.jpg", "storage_path": "trip-1/photo-3.jpg"}]
            self._eq = None

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self._eq = (key, value)
            return self

        def execute(self):
            if self._eq == ("id", "trip-1/photo-3.jpg"):
                return type("Resp", (), {"data": self.rows})()
            return type("Resp", (), {"data": []})()

    class FakeStorage:
        def from_(self, bucket_name):
            return self

        def upload(self, *args, **kwargs):
            return {"path": "trip-1/generated_gap_scene-1.png"}

        def list(self, prefix=""):
            return []

        def remove(self, *args, **kwargs):
            return []

    class FakeSupabase:
        def __init__(self):
            self.storage = FakeStorage()
            self._scene_table = FakeSceneTable()
            self._panel_table = FakePanelTable()
            self._photo_table = FakePhotosTable()

        def table(self, name):
            if name == "scenes":
                return self._scene_table
            if name == "panels":
                return self._panel_table
            if name == "photos":
                return self._photo_table
            raise AssertionError(name)

    monkeypatch.setattr("app.services.diary_generator.supabase", FakeSupabase())
    monkeypatch.setattr("app.services.diary_generator.get_image", lambda path: b"photo-bytes")
    monkeypatch.setattr("app.services.diary_generator.analyze_images", fake_analyze_images)
    monkeypatch.setattr("app.services.diary_generator.generate_diary_illustration", fake_generate_diary_illustration)

    __import__("app.services.diary_generator", fromlist=["fill_gap_scenes_for_trip"]).fill_gap_scenes_for_trip("trip-1")

    assert panel_updates[-1]["status"] == "done"
    assert scene_updates[-1]["summary"] == "東大寺の朝。鹿がのんびり歩いていて、思ったより人が少なかった。"
    assert all("is_gap" not in payload for payload in scene_updates)


def test_process_pending_panels_updates_pending_rows_by_mode(monkeypatch):
    scene_updates = []
    panel_updates = []

    def fake_generate_diary_illustration(summary, events=None, **kwargs):
        assert "空白の時間を埋める" not in summary
        return b"generated-illustration"

    def fake_analyze_images(images, image_names=None):
        return {"summary": "東大寺の朝。鹿がのんびり歩いていて、思ったより人が少なかった。", "events": ["朝の散歩"]}

    class FakeSceneTable:
        def __init__(self):
            self.rows = [
                {"id": "scene-1", "trip_id": "trip-1", "seq": 1, "is_gap": False, "photo_ids": ["p1"], "summary": "旧要約1"},
                {"id": "scene-2", "trip_id": "trip-1", "seq": 2, "is_gap": True, "photo_ids": [], "summary": "旧要約2"},
                {"id": "scene-3", "trip_id": "trip-1", "seq": 3, "is_gap": False, "photo_ids": ["p3"], "summary": "旧要約3"},
                {"id": "scene-4", "trip_id": "trip-1", "seq": 4, "is_gap": True, "photo_ids": [], "summary": "旧要約4"},
                {"id": "scene-5", "trip_id": "trip-1", "seq": 5, "is_gap": False, "photo_ids": ["p5"], "summary": "旧要約5"},
            ]
            self._eq = None

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self._eq = (key, value)
            return self

        def order(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self._eq == ("id", "scene-1"):
                return type("Resp", (), {"data": [self.rows[0]]})()
            if self._eq == ("id", "scene-2"):
                return type("Resp", (), {"data": [self.rows[1]]})()
            if self._eq == ("id", "scene-3"):
                return type("Resp", (), {"data": [self.rows[2]]})()
            if self._eq == ("id", "scene-4"):
                return type("Resp", (), {"data": [self.rows[3]]})()
            if self._eq == ("id", "scene-5"):
                return type("Resp", (), {"data": [self.rows[4]]})()
            return type("Resp", (), {"data": []})()

        def update(self, payload):
            scene_updates.append(payload)
            return self

    class FakePanelTable:
        def __init__(self):
            self.rows = [
                {"id": "panel-1", "scene_id": "scene-1", "mode": "i2i", "status": "pending", "image_path": None},
                {"id": "panel-2", "scene_id": "scene-2", "mode": "gen", "status": "pending", "image_path": None},
                {"id": "panel-3", "scene_id": "scene-3", "mode": "i2i", "status": "pending", "image_path": None},
                {"id": "panel-4", "scene_id": "scene-4", "mode": "gen", "status": "pending", "image_path": None},
                {"id": "panel-5", "scene_id": "scene-5", "mode": "i2i", "status": "pending", "image_path": None},
            ]
            self._eq = None

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self._eq = (key, value)
            return self

        def execute(self):
            if self._eq == ("status", "pending"):
                return type("Resp", (), {"data": self.rows})()
            if self._eq == ("id", "panel-1"):
                return type("Resp", (), {"data": [self.rows[0]]})()
            if self._eq == ("id", "panel-2"):
                return type("Resp", (), {"data": [self.rows[1]]})()
            if self._eq == ("id", "panel-3"):
                return type("Resp", (), {"data": [self.rows[2]]})()
            if self._eq == ("id", "panel-4"):
                return type("Resp", (), {"data": [self.rows[3]]})()
            if self._eq == ("id", "panel-5"):
                return type("Resp", (), {"data": [self.rows[4]]})()
            return type("Resp", (), {"data": []})()

        def update(self, payload):
            panel_updates.append(payload)
            return self

    class FakeStorage:
        def from_(self, bucket_name):
            return self

        def upload(self, *args, **kwargs):
            return {"path": "generated/panel-2.png"}

        def list(self, prefix=""):
            return []

    class FakePhotosTable:
        def __init__(self):
            self.rows = [
                {"id": "p1", "storage_path": "trip-1/p1.jpg"},
                {"id": "p3", "storage_path": "trip-1/p3.jpg"},
                {"id": "p5", "storage_path": "trip-1/p5.jpg"},
            ]
            self._eq = None

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self._eq = (key, value)
            return self

        def execute(self):
            if self._eq and self._eq[0] == "id":
                target = self._eq[1]
                matches = [row for row in self.rows if row.get("id") == target]
                return type("Resp", (), {"data": matches})()
            return type("Resp", (), {"data": []})()

    class FakeSupabase:
        def __init__(self):
            self.storage = FakeStorage()
            self._scene_table = FakeSceneTable()
            self._panel_table = FakePanelTable()
            self._photo_table = FakePhotosTable()

        def table(self, name):
            if name == "scenes":
                return self._scene_table
            if name == "panels":
                return self._panel_table
            if name == "photos":
                return self._photo_table
            raise AssertionError(name)

    monkeypatch.setattr("app.services.diary_generator.supabase", FakeSupabase())
    monkeypatch.setattr("app.services.diary_generator.get_image", lambda path: b"photo-bytes")
    monkeypatch.setattr("app.services.diary_generator.analyze_images", fake_analyze_images)
    monkeypatch.setattr("app.services.diary_generator.generate_diary_illustration", fake_generate_diary_illustration)

    __import__("app.services.diary_generator", fromlist=["process_pending_panels"]).process_pending_panels("trip-1")

    assert [update.get("status") for update in panel_updates if "status" in update] == ["running", "done", "running", "done", "running", "done", "running", "done", "running", "done"]
    assert any("東大寺の朝" in str(update.get("summary", "")) and "鹿" in str(update.get("summary", "")) for update in scene_updates)
    assert all("is_gap" not in update for update in scene_updates)


def test_generate_diary_illustration_uses_gemini_image_model_when_available(monkeypatch):
    class FakeInlineData:
        data = b"fake-generated-png"

    class FakePart:
        def __init__(self):
            self.inline_data = FakeInlineData()
            self.text = None

    class FakeContent:
        def __init__(self):
            self.parts = [FakePart()]

    class FakeCandidate:
        def __init__(self):
            self.content = FakeContent()

    class FakeResponse:
        def __init__(self):
            self.candidates = [FakeCandidate()]

    class FakeModels:
        def generate_content(self, **kwargs):
            return FakeResponse()

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(gemini, "client", FakeClient())
    monkeypatch.setattr(gemini, "_image_model_name", "gemini-2.0-flash-preview-image-generation")

    result = gemini.generate_diary_illustration("寺院で桜を見ました。", ["鹿も見かけました"])

    assert result == b"fake-generated-png"


def test_generate_diary_illustration_returns_png_bytes():
    png = gemini.generate_diary_illustration("寺院で桜を見ました。", ["鹿も見かけました"])
    assert png.startswith(b"\x89PNG\r\n\x1a\n")
    assert len(png) > 1000


def test_generate_diary_illustration_changes_by_summary_context():
    beach = gemini.generate_diary_illustration("海辺の夕方で波と風が強かった。", ["散歩して夕焼けを見た"])
    city = gemini.generate_diary_illustration("夜の街で駅前を歩いて、明かりがきれいだった。", ["ラストの散歩"])

    assert beach.startswith(b"\x89PNG\r\n\x1a\n")
    assert city.startswith(b"\x89PNG\r\n\x1a\n")
    assert beach != city


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

    class FakePart:
        text = '{"summary": "ok", "events": ["event1"]}'

    class FakeContent:
        parts = [FakePart()]

    class FakeCandidate:
        content = FakeContent()

    class FakeModels:
        @staticmethod
        def generate_content(**kwargs):
            attempts["count"] += 1
            if attempts["count"] == 1:
                raise RuntimeError("503 UNAVAILABLE")
            return type("Response", (), {"candidates": [FakeCandidate()]})()

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(gemini, "client", FakeClient())

    result = gemini.analyze_images([b"abc", b"def"], image_names=["a.jpg", "b.jpg"])

    assert result["summary"] == "ok"
    assert attempts["count"] == 2


def test_analyze_images_parses_markdown_json(monkeypatch):
    class FakePart:
        text = '```json\n{"summary": "ok", "events": ["event1"]}\n```'

    class FakeContent:
        parts = [FakePart()]

    class FakeCandidate:
        content = FakeContent()

    class FakeModels:
        @staticmethod
        def generate_content(**kwargs):
            return type("Response", (), {"candidates": [FakeCandidate()]})()

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(gemini, "client", FakeClient())

    result = gemini.analyze_images([b"abc"], image_names=["a.jpg"])

    assert result["summary"] == "ok"
    assert result["events"] == ["event1"]


def test_write_gap_text_uses_before_and_after_summaries():
    text = gemini.write_gap_text("朝の寺院を散策した", "夕方の港町を歩いた")

    assert "空白の時間" in text
    assert "朝の寺院を散策した" in text
    assert "夕方の港町を歩いた" in text


def test_generate_image_wrapper_calls_diary_illustration(monkeypatch):
    captured = {}

    def fake_generate_diary_illustration(summary, events=None):
        captured["summary"] = summary
        captured["events"] = events
        return b"generated-by-wrapper"

    monkeypatch.setattr(gemini, "generate_diary_illustration", fake_generate_diary_illustration)

    result = gemini.generate_image("港町の夕方を歩いて、灯りがきれいだった")

    assert result == b"generated-by-wrapper"
    assert "港町の夕方" in captured["summary"]
    assert captured["events"] is None
