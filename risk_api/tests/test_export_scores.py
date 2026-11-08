"""The export command is tested through its output file, not its internals."""
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = json.loads((ROOT / "ml" / "sample_assets.json").read_text())


def run_export(out: Path) -> dict:
    subprocess.run([sys.executable, "-m", "risk_api.export_scores", "--out", str(out)], cwd=ROOT, check=True)
    return json.loads(out.read_text())


def test_every_sample_asset_has_probability_level_and_reasons(tmp_path):
    data = run_export(tmp_path / "scores.json")
    by_id = {s["asset_id"]: s for s in data["scores"]}
    assert set(by_id) == {a["asset_id"] for a in ASSETS}
    for s in by_id.values():
        assert 0.0 <= s["p_block"] <= 1.0
        assert s["level"] in {"low", "medium", "high"}
        assert s["reasons"] and all(isinstance(r, str) and r for r in s["reasons"])


def test_file_says_where_the_scores_came_from(tmp_path):
    data = run_export(tmp_path / "scores.json")
    assert "SAMPLE DATA" in data["data_source"]
    datetime.fromisoformat(data["generated_at"])
    assert data["model_version"]
    assert {"leaf_index", "rain_mm_7d", "rain_forecast_mm"} <= set(data["scenario"])


def test_two_runs_give_the_same_scores(tmp_path):
    first = run_export(tmp_path / "a.json")
    second = run_export(tmp_path / "b.json")
    assert first["scores"] == second["scores"]
    assert first["model_version"] == second["model_version"]


def test_file_is_small_and_has_no_secrets(tmp_path):
    out = tmp_path / "scores.json"
    data = run_export(out)
    assert len(out.read_text()) < 50_000
    assert set(data) == {"data_source", "generated_at", "model_version", "scenario", "scores"}
    assert all(set(s) == {"asset_id", "p_block", "level", "reasons"} for s in data["scores"])
