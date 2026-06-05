from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from backend.app.data.seed import VAGA_ID
from backend.app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/v1/ops/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_site_recommendations_prioritize_safe_sites():
    response = client.get("/v1/sites/recommendations", params={"lat": 61.88, "lon": 9.1, "radius_km": 200, "pilot_level": "beginner"})
    assert response.status_code == 200
    body = response.json()
    assert body
    assert body[0]["status"] in {"GO", "MAYBE"}
    assert "top_reasons" in body[0]


def test_flyability_exposes_blockers():
    response = client.get(f"/v1/flyability/sites/{VAGA_ID}/timeline")
    assert response.status_code == 200
    hours = response.json()
    assert any(hour["blockers"] for hour in hours)
    assert all("explanation" in hour for hour in hours)


def test_briefing_is_grounded_and_has_safety_footer():
    start = datetime.now(timezone.utc)
    response = client.post(
        "/v1/briefings/site",
        json={
            "question": "Can I fly this site today?",
            "site_id": str(VAGA_ID),
            "start": start.isoformat(),
            "end": (start + timedelta(hours=3)).isoformat(),
            "include_sources": True,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["grounded_facts"]
    assert "Verify actual conditions" in body["safety_footer"]

