from fastapi.testclient import TestClient

from app.main import app


def test_app_imports():
    assert app.title == "Dome Document Intelligence"


def test_health_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"ok", "degraded"}
