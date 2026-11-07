"""Train the blockage-risk model on SIMULATED data and save it to ml/model.joblib."""
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier

from ml.simulate import simulate

FEATURES = [
    "is_gpt", "canopy_pct", "leaf_index", "rain_mm_7d",
    "rain_forecast_mm", "days_since_clean", "has_camera",
]
# Domain constraint: more canopy / leaf fall / recent rain / days since clean never lowers risk.
# Order matches FEATURES: is_gpt, canopy, leaf, rain_7d, rain_forecast, days_since_clean, has_camera.
MONOTONIC_CST = [0, 1, 1, 1, 0, 1, 0]
DEFAULT_PATH = Path(__file__).parent / "model.joblib"
DATA_SOURCE = "simulated (ml/simulate.py) - SAMPLE DATA, not observed council records"


def to_vector(row: dict) -> list[float]:
    return [
        1.0 if row["type"] == "gpt" else 0.0,
        row["canopy_pct"], row["leaf_index"], row["rain_mm_7d"],
        row["rain_forecast_mm"], row["days_since_clean"],
        1.0 if row["has_camera"] else 0.0,
    ]


def train(seed: int = 0, n: int = 20000, out_path: Path = DEFAULT_PATH) -> dict:
    rows = simulate(seed=seed, n=n)
    X = np.array([to_vector(r) for r in rows])
    y = np.array([r["blocked"] for r in rows])
    model = HistGradientBoostingClassifier(monotonic_cst=MONOTONIC_CST, random_state=seed).fit(X, y)
    bundle = {
        "model": model,
        "features": FEATURES,
        "means": X.mean(axis=0).tolist(),
        "meta": {"data_source": DATA_SOURCE, "seed": seed, "n": n},
    }
    joblib.dump(bundle, out_path)
    return bundle["meta"]


if __name__ == "__main__":
    print(train())
