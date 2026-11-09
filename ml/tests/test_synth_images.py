import json

from ml.synth_images import BANDS, DAMAGES, W, H, generate, main


def _all(seed=1, per_band=1, per_damage=1, cameras=1):
    return list(generate(seed, cameras, per_band, per_damage))


def test_same_seed_same_pixels():
    a, b = _all(seed=7), _all(seed=7)
    assert [m for _, _, m in a] == [m for _, _, m in b]
    assert all(x[1].tobytes() == y[1].tobytes() for x, y in zip(a, b))


def test_different_seed_differs():
    a, b = _all(seed=7), _all(seed=8)
    assert a[1][1].tobytes() != b[1][1].tobytes()


def test_bands_cover_all_ten_and_match_fullness():
    bands = {}
    for _, _, m in _all(per_band=3):
        if m["kind"] == "band":
            assert int(m["fullness_pct"] // 10) == m["band"]
            bands.setdefault(m["band"], 0)
            bands[m["band"]] += 1
    assert sorted(bands) == list(range(BANDS)) and set(bands.values()) == {3}


def test_one_reference_per_camera_and_counts():
    items = _all(cameras=2, per_band=2, per_damage=3)
    assert sum(m["kind"] == "reference" for _, _, m in items) == 2
    for d in DAMAGES:
        assert sum(m["damage"] == d for _, _, m in items) == 6
    assert len(items) == 2 * (1 + 10 * 2 + 2 * 3)


def test_metadata_complete_and_labelled_synthetic():
    for name, img, m in _all():
        assert "synthetic" in name and m["synthetic"] is True
        assert img.size == (W, H)
        for key in ("file", "camera_id", "kind", "band", "fullness_pct", "damage", "region", "seed", "generator_version"):
            assert key in m
        if m["damage"] != "none":
            x0, y0, x1, y1 = m["region"]
            assert 0 <= x0 < x1 <= W and 0 <= y0 < y1 <= H


def test_cli_writes_images_and_metadata(tmp_path, monkeypatch):
    monkeypatch.setattr("sys.argv", ["x", "--out", str(tmp_path), "--cameras", "1", "--per-band", "1", "--per-damage", "1"])
    main()
    meta = json.loads((tmp_path / "metadata.json").read_text())
    assert "SYNTHETIC" in meta["data_source"]
    assert all((tmp_path / m["file"]).exists() for m in meta["images"])
