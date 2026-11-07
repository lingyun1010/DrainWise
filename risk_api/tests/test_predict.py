import pytest
from fastapi.testclient import TestClient

from ml.train import train
from risk_api.main import create_app


def asset(asset_id="A1", **overrides):
    base = {
        "asset_id": asset_id, "type": "inlet", "canopy_pct": 30.0, "leaf_index": 50.0,
        "rain_mm_7d": 20.0, "rain_forecast_mm": 10.0, "days_since_clean": 60,
        "has_camera": False,
    }
    return {**base, **overrides}


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    model_path = tmp_path_factory.mktemp("model") / "model.joblib"
    train(seed=0, n=3000, out_path=model_path)
    return TestClient(create_app(model_path))


def test_predict_returns_one_scored_result_per_asset(client):
    res = client.post("/predict", json=[asset("A1"), asset("A2", type="gpt")])

    assert res.status_code == 200
    body = res.json()
    assert [r["asset_id"] for r in body] == ["A1", "A2"]
    for r in body:
        assert 0.0 <= r["p_block"] <= 1.0
        assert r["level"] in {"low", "medium", "high"}


def test_a_neglected_asset_under_heavy_canopy_explains_why_it_is_risky(client):
    res = client.post("/predict", json=[asset("A9", canopy_pct=65.0, days_since_clean=170, leaf_index=90.0)])

    reasons = res.json()[0]["reasons"]
    assert "Heavy tree cover nearby" in reasons
    assert "Last cleaned 170 days ago" in reasons


def test_every_score_has_at_least_one_reason(client):
    res = client.post("/predict", json=[asset("A1"), asset("A2", canopy_pct=2.0, days_since_clean=3)])

    for r in res.json():
        assert len(r["reasons"]) >= 1


def p_of(client, **overrides):
    return client.post("/predict", json=[asset(**overrides)]).json()[0]


def test_risk_does_not_fall_as_days_since_clean_or_canopy_rise(client):
    by_days = [p_of(client, days_since_clean=d)["p_block"] for d in (5, 40, 90, 150)]
    by_canopy = [p_of(client, canopy_pct=c)["p_block"] for c in (5, 20, 40, 65)]

    assert by_days == sorted(by_days)
    assert by_canopy == sorted(by_canopy)


def test_extreme_assets_land_in_the_obvious_levels(client):
    worst = p_of(client, canopy_pct=70.0, leaf_index=100.0, rain_mm_7d=80.0, days_since_clean=170)
    best = p_of(client, canopy_pct=0.0, leaf_index=0.0, rain_mm_7d=0.0, days_since_clean=1)

    assert worst["level"] == "high"
    assert best["level"] == "low"
