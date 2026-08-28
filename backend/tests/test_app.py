from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_healthz():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_daily_diary(monkeypatch):
    class FakeFrom:
        def list(self, path):
            assert path == "user_001/2026-08-28/"
            return [{"name": "photo1.jpg"}, {"name": "photo2.jpg"}]

    class FakeStorage:
        def from_(self, bucket_name):
            assert bucket_name == "photos"
            return FakeFrom()

    monkeypatch.setattr("app.api.diary.supabase", type("DummySupabase", (), {"storage": FakeStorage()})())
    monkeypatch.setattr("app.api.diary.generate_daily_diary", lambda user_id, date: {
        "user_id": user_id,
        "date": date,
        "image_count": 2,
        "summary": "1日の出来事を要約",
        "events": ["event1", "event2"],
    })

    response = client.get("/daily-diary", params={"user_id": "user_001", "date": "2026-08-28"})

    assert response.status_code == 200
    assert response.json()["image_count"] == 2
    assert response.json()["summary"] == "1日の出来事を要約"
