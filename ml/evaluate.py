"""Pipeline recovery check for the risk model. Runs on SIMULATED data (SAMPLE DATA).

This is NOT an accuracy measurement: the simulator and the model share the same
assumed rules, so a good score only shows the pipeline recovers them.
Usage: python -m ml.evaluate
"""
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import brier_score_loss, roc_auc_score

from ml.simulate import simulate
from ml.train import DEFAULT_PATH, FEATURES, to_vector

EVAL_SEED = 12345  # training uses seed 0; this one is held out
MONOTONIC_FEATURES = ["canopy_pct", "leaf_index", "rain_mm_7d", "days_since_clean"]
TOLERANCE = 1e-9


def demo_formula(row: dict) -> float:
    """The demo's transparent placeholder score (not a trained model), as in CLAUDE.md."""
    s = (
        0.45 * row["canopy_pct"] / 70
        + 0.35 * row["leaf_index"] / 100
        + 0.2 * min(1.0, row["rain_mm_7d"] / 80)
    ) * (0.2 + 0.8 * min(1.0, row["days_since_clean"] / 150))
    return float(s)


def monotonic_violations(model, base_rows: list[dict], n_steps: int = 8) -> dict[str, int]:
    """Count rows where raising one feature lowers predicted risk. 0 means the rule holds."""
    ranges = {"canopy_pct": (0, 70), "leaf_index": (0, 100), "rain_mm_7d": (0, 80), "days_since_clean": (0, 180)}
    result = {}
    for feat in MONOTONIC_FEATURES:
        lo, hi = ranges[feat]
        grid = np.linspace(lo, hi, n_steps)
        X = np.array([[to_vector({**r, feat: v}) for v in grid] for r in base_rows])  # rows x steps x feats
        p = model.predict_proba(X.reshape(-1, X.shape[-1]))[:, 1].reshape(len(base_rows), n_steps)
        result[feat] = int((np.diff(p, axis=1) < -TOLERANCE).any(axis=1).sum())
    return result


def evaluate(model_path: Path = DEFAULT_PATH, seed: int = EVAL_SEED, n: int = 5000) -> dict:
    bundle = joblib.load(model_path)
    model = bundle["model"]
    assert bundle["features"] == FEATURES
    rows = simulate(seed=seed, n=n)
    y = np.array([r["blocked"] for r in rows])
    p = model.predict_proba(np.array([to_vector(r) for r in rows]))[:, 1]
    s = np.array([demo_formula(r) for r in rows])
    violations = monotonic_violations(model, rows[:300])
    return {
        "data_source": "simulated (ml/simulate.py) - SAMPLE DATA",
        "eval_seed": seed,
        "n": n,
        "train_meta": bundle["meta"],
        "model_auc": float(roc_auc_score(y, p)),
        "model_brier": float(brier_score_loss(y, p)),
        "demo_formula_auc": float(roc_auc_score(y, s)),
        "monotonic_violations": violations,
        "monotonic_ok": not any(violations.values()),
    }


if __name__ == "__main__":
    r = evaluate()
    print("PIPELINE RECOVERY CHECK on SIMULATED data. Not an accuracy claim.")
    for k, v in r.items():
        print(f"{k}: {v}")
