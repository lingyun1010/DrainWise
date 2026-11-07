"""FastAPI service serving blockage-risk predictions."""
from pathlib import Path

import joblib
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel

from ml.train import DEFAULT_PATH, to_vector

HIGH_AT = 0.6
MEDIUM_AT = 0.3


class AssetIn(BaseModel):
    asset_id: str
    type: str
    canopy_pct: float
    leaf_index: float
    rain_mm_7d: float
    rain_forecast_mm: float
    days_since_clean: int
    has_camera: bool


def level_for(p: float) -> str:
    return "high" if p >= HIGH_AT else "medium" if p >= MEDIUM_AT else "low"


# (feature index in ml.train.FEATURES, text when it raises risk, text when it lowers risk)
REASON_FEATURES = {
    0: ("Asset type: GPT", "Asset type: inlet"),
    1: ("Heavy tree cover nearby", "Little tree cover nearby"),
    2: ("High leaf-fall season", "Low leaf-fall season"),
    3: ("Heavy rain in the last 7 days", "Little rain in the last 7 days"),
    4: ("Significant rain forecast", "No significant rain forecast"),
    5: ("Last cleaned {days} days ago", "Cleaned recently ({days} days ago)"),
}
MAX_REASONS = 3


def explain(model, means: list[float], x: np.ndarray, p: float, days: int) -> list[str]:
    """Occlusion: swap one feature at a time for its training mean and see how p changes."""
    deltas = []
    for i in REASON_FEATURES:
        x_mean = x.copy()
        x_mean[i] = means[i]
        deltas.append((p - float(model.predict_proba(x_mean.reshape(1, -1))[0, 1]), i))
    raising = sorted([d for d in deltas if d[0] > 0], reverse=True)[:MAX_REASONS]
    if raising:
        picks = [(i, 0) for _, i in raising]
    else:
        lowest = min(deltas)
        picks = [(lowest[1], 1)]
    return [REASON_FEATURES[i][k].format(days=days) for i, k in picks]


def create_app(model_path: Path = DEFAULT_PATH) -> FastAPI:
    bundle = joblib.load(model_path)
    model = bundle["model"]
    means = bundle["means"]
    app = FastAPI(title="DrainWise risk API (trained on simulated sample data)")

    @app.post("/predict")
    def predict(assets: list[AssetIn]):
        X = np.array([to_vector(a.model_dump()) for a in assets])
        probs = model.predict_proba(X)[:, 1]
        return [
            {
                "asset_id": a.asset_id,
                "p_block": float(p),
                "level": level_for(float(p)),
                "reasons": explain(model, means, X[i], float(p), a.days_since_clean),
            }
            for i, (a, p) in enumerate(zip(assets, probs))
        ]

    return app


def _default_app() -> FastAPI:
    return create_app()


app = _default_app() if DEFAULT_PATH.exists() else None
