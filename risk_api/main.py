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


def explain(model, means: list[float], X: np.ndarray, probs: np.ndarray, days: list[int]) -> list[list[str]]:
    """Occlusion: swap one feature at a time for its training mean and see how p changes.

    One predict_proba call for all assets and features (calling it per asset and feature took ~1 s for 36 assets).
    """
    idx = list(REASON_FEATURES)
    swapped = np.repeat(X[:, None, :], len(idx), axis=1)  # (assets, features, columns)
    for k, i in enumerate(idx):
        swapped[:, k, i] = means[i]
    p_swapped = model.predict_proba(swapped.reshape(-1, X.shape[1]))[:, 1].reshape(len(X), len(idx))
    out = []
    for row, p in enumerate(probs):
        deltas = [(float(p - p_swapped[row, k]), i) for k, i in enumerate(idx)]
        raising = sorted([d for d in deltas if d[0] > 0], reverse=True)[:MAX_REASONS]
        if raising:
            picks = [(i, 0) for _, i in raising]
        else:
            picks = [(min(deltas)[1], 1)]
        out.append([REASON_FEATURES[i][k].format(days=days[row]) for i, k in picks])
    return out


def create_app(model_path: Path = DEFAULT_PATH) -> FastAPI:
    bundle = joblib.load(model_path)
    model = bundle["model"]
    means = bundle["means"]
    app = FastAPI(title="DrainWise risk API (trained on simulated sample data)")

    @app.post("/predict")
    def predict(assets: list[AssetIn]):
        X = np.array([to_vector(a.model_dump()) for a in assets])
        probs = model.predict_proba(X)[:, 1]
        reasons = explain(model, means, X, probs, [a.days_since_clean for a in assets])
        return [
            {"asset_id": a.asset_id, "p_block": float(p), "level": level_for(float(p)), "reasons": reasons[i]}
            for i, (a, p) in enumerate(zip(assets, probs))
        ]

    return app


def _default_app() -> FastAPI:
    return create_app()


app = _default_app() if DEFAULT_PATH.exists() else None
