from ml.simulate import simulate

CONTRACT_FIELDS = {
    "asset_id", "type", "canopy_pct", "leaf_index", "rain_mm_7d",
    "rain_forecast_mm", "days_since_clean", "has_camera",
}


def test_simulate_returns_n_assets_with_predict_contract_fields_and_a_label():
    rows = simulate(seed=0, n=50)

    assert len(rows) == 50
    for row in rows:
        assert CONTRACT_FIELDS <= set(row)
        assert row["blocked"] in (0, 1)


def _block_rate(rows):
    return sum(r["blocked"] for r in rows) / len(rows)


def test_assets_left_long_under_heavy_canopy_block_more_than_freshly_cleaned_bare_ones():
    rows = simulate(seed=1, n=5000)

    risky = [r for r in rows if r["days_since_clean"] > 120 and r["canopy_pct"] > 40]
    safe = [r for r in rows if r["days_since_clean"] < 30 and r["canopy_pct"] < 15]

    assert len(risky) > 50 and len(safe) > 50
    assert _block_rate(risky) > _block_rate(safe) + 0.2


def test_same_seed_gives_identical_data_and_different_seed_gives_different_data():
    assert simulate(seed=7, n=100) == simulate(seed=7, n=100)
    assert simulate(seed=7, n=100) != simulate(seed=8, n=100)
