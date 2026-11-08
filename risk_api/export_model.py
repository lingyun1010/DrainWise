"""Export the trained model as plain JSON trees: `python -m risk_api.export_model`.

The model is a gradient-boosted tree ensemble, so it is just thresholds and leaf values. The web app walks the
trees in TypeScript (planner/src/riskModel.ts), which lets the public build run what-if without a server.
Also writes parity cases (inputs plus the Python answers) so a planner test can prove both sides agree.
Trained on SIMULATED data: SAMPLE DATA, not observed council records.
"""
import argparse
import json
from pathlib import Path

import joblib
import numpy as np

from ml.train import DEFAULT_PATH, to_vector
from risk_api.export_scores import model_version
from risk_api.main import REASON_FEATURES, explain, level_for

ROOT = Path(__file__).resolve().parents[1]
ASSETS_PATH = ROOT / "ml" / "sample_assets.json"
DEFAULT_OUT = ROOT / "web" / "lib" / "riskModel.json"
DEFAULT_PARITY = ROOT / "planner" / "src" / "riskModel.parity.json"

# Scenarios the parity cases cover (leaf_index, rain_mm_7d, rain_forecast_mm): default, dry, and very wet.
SCENARIOS = [(60, 20, 10), (0, 0, 0), (100, 80, 80), (35, 5, 52)]


def trees_of(model) -> list[dict]:
    out = []
    for group in model._predictors:
        (tree,) = group  # binary classification: one tree per round
        n = tree.nodes
        out.append(
            {
                "f": n["feature_idx"].tolist(),
                "t": [round(float(v), 9) for v in n["num_threshold"]],
                "l": n["left"].tolist(),
                "r": n["right"].tolist(),
                "v": [round(float(v), 9) for v in n["value"]],
                "leaf": n["is_leaf"].astype(int).tolist(),
            }
        )
    return out


def build(model_path: Path = DEFAULT_PATH) -> dict:
    bundle = joblib.load(model_path)
    model = bundle["model"]
    return {
        "model_version": model_version(model_path),
        "data_source": bundle["meta"]["data_source"] + "; SAMPLE DATA",
        "baseline": float(np.ravel(model._baseline_prediction)[0]),
        "means": bundle["means"],
        "reasons": {str(i): list(t) for i, t in REASON_FEATURES.items()},
        "trees": trees_of(model),
    }


def parity_cases(model_path: Path = DEFAULT_PATH, assets_path: Path = ASSETS_PATH) -> list[dict]:
    bundle = joblib.load(model_path)
    model, means = bundle["model"], bundle["means"]
    cases = []
    for leaf, rain7, forecast in SCENARIOS:
        rows = [
            {**a, "leaf_index": leaf, "rain_mm_7d": rain7, "rain_forecast_mm": forecast}
            for a in json.loads(assets_path.read_text())
        ]
        X = np.array([to_vector(r) for r in rows])
        probs = model.predict_proba(X)[:, 1]
        reasons = explain(model, means, X, probs, [r["days_since_clean"] for r in rows])
        for r, p, why in zip(rows, probs, reasons):
            cases.append({"input": r, "p_block": float(p), "level": level_for(float(p)), "reasons": why})
    return cases


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--parity-out", type=Path, default=DEFAULT_PARITY)
    args = parser.parse_args()
    data = build()
    args.out.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    cases = parity_cases()
    args.parity_out.write_text(json.dumps(cases, separators=(",", ":")) + "\n")
    print(f"wrote {args.out} ({len(data['trees'])} trees, {args.out.stat().st_size // 1024} KB), {len(cases)} parity cases")


if __name__ == "__main__":
    main()
