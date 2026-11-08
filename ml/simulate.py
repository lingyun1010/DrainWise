"""Simulated asset records. All output is SAMPLE DATA, not observed council data."""
import numpy as np


def simulate(seed: int, n: int) -> list[dict]:
    rng = np.random.default_rng(seed)
    rows = []
    for i in range(n):
        rows.append({
            "asset_id": f"A{i:04d}",
            "type": "gpt" if rng.random() < 0.2 else "inlet",
            "canopy_pct": float(rng.uniform(0, 70)),
            "leaf_index": float(rng.uniform(0, 100)),
            "rain_mm_7d": float(rng.uniform(0, 80)),
            "rain_forecast_mm": float(rng.uniform(0, 80)),
            "days_since_clean": int(rng.integers(0, 180)),
            "has_camera": bool(rng.random() < 0.25),
        })
        row = rows[-1]
        row["blocked"] = int(rng.random() < _p_block(row))
    return rows


def _p_block(row: dict) -> float:
    """Assumed (made-up) generating process for sample data. Not observed behaviour."""
    risk = (
        0.40 * row["canopy_pct"] / 70
        + 0.30 * row["leaf_index"] / 100
        + 0.15 * min(1.0, row["rain_mm_7d"] / 80)
        + 0.15 * min(1.0, row["rain_forecast_mm"] / 80)  # forecast rain washes leaves into drains
    )
    age = min(1.0, row["days_since_clean"] / 150)
    score = risk * (0.2 + 0.8 * age)
    if row["type"] == "gpt":
        score *= 1.1
    return float(1 / (1 + np.exp(-(score - 0.3) * 10)))
