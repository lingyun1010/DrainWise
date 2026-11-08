import numpy as np

from ml.evaluate import evaluate, monotonic_violations
from ml.simulate import simulate


def test_evaluate_reports_metrics_in_a_sane_range_and_monotonic_rules_hold():
    r = evaluate(seed=7, n=2000)

    assert 0.7 < r["model_auc"] <= 1.0
    assert 0.0 <= r["model_brier"] < 0.25
    assert 0.7 < r["demo_formula_auc"] <= 1.0
    assert r["monotonic_ok"] is True
    assert set(r["monotonic_violations"]) == {"canopy_pct", "leaf_index", "rain_mm_7d", "days_since_clean"}


class _CanopyDecreases:
    """A deliberately broken model: risk falls as canopy rises (feature index 1)."""

    def predict_proba(self, X):
        p = 1 - np.clip(X[:, 1] / 70, 0, 1)
        return np.column_stack([1 - p, p])


def test_a_broken_monotonic_rule_is_reported():
    v = monotonic_violations(_CanopyDecreases(), simulate(seed=1, n=20))

    assert v["canopy_pct"] > 0
    assert v["leaf_index"] == 0
