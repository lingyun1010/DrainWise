"""Write precomputed risk scores for the sample assets: `python -m risk_api.export_scores`.

Runs the default scenario through the same /predict code path as the live service and stamps the file with
the data source, generation time and model version. The public build and the offline fallback read this file.
Scores are SAMPLE DATA from a model trained on simulated records, not observed council data.
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
from fastapi.testclient import TestClient

from ml.train import DEFAULT_PATH
from risk_api.main import create_app

ROOT = Path(__file__).resolve().parents[1]
ASSETS_PATH = ROOT / "ml" / "sample_assets.json"
DEFAULT_OUT = ROOT / "web" / "lib" / "precomputedScores.json"

# Same as the Manager page on first load: leaf-fall slider 60, no extra rain, nothing cleaned yet.
SCENARIO = {"leaf_index": 60, "rain_mm_7d": 20, "rain_forecast_mm": 10}


def model_version(model_path: Path) -> str:
    meta = joblib.load(model_path)["meta"]
    digest = hashlib.sha256(model_path.read_bytes()).hexdigest()[:12]
    return f"HistGradientBoosting seed={meta['seed']} n={meta['n']} sha256={digest}"


def build(model_path: Path = DEFAULT_PATH, assets_path: Path = ASSETS_PATH) -> dict:
    assets = json.loads(assets_path.read_text())
    payload = [{**a, **SCENARIO} for a in assets]
    res = TestClient(create_app(model_path)).post("/predict", json=payload)
    res.raise_for_status()
    scores = [{**s, "p_block": round(s["p_block"], 4)} for s in res.json()]
    return {
        "data_source": joblib.load(model_path)["meta"]["data_source"] + "; sample assets, SAMPLE DATA",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model_version": model_version(model_path),
        "scenario": {**SCENARIO, "note": "default scenario: no extra rain, no asset cleaned yet"},
        "scores": scores,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    data = build()
    args.out.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {args.out} ({len(data['scores'])} assets, {data['model_version']})")


if __name__ == "__main__":
    main()
