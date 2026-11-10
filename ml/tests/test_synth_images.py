import json

import numpy as np
import pytest
from PIL import Image

from ml.synth_images import BANDS, CAMERAS, DAMAGES, generate, main


@pytest.fixture(scope="module")
def photos(tmp_path_factory):
    """Stand-in photos (random noise, 960x720) so tests never need the council photos."""
    d = tmp_path_factory.mktemp("photos")
    rng = np.random.default_rng(0)
    for cam in CAMERAS:
        Image.fromarray(rng.integers(0, 255, (720, 960, 3), dtype=np.uint8)).save(d / cam["photo"])
    return d


def _all(photos, seed=1, per_band=1, per_damage=1, cameras=1):
    return list(generate(photos, seed, per_band, per_damage, cameras))


def test_same_seed_same_pixels(photos):
    a, b = _all(photos, seed=7), _all(photos, seed=7)
    assert [m for _, _, m in a] == [m for _, _, m in b]
    assert all(x[1].tobytes() == y[1].tobytes() for x, y in zip(a, b))


def test_different_seed_differs(photos):
    a, b = _all(photos, seed=7), _all(photos, seed=8)
    assert a[1][1].tobytes() != b[1][1].tobytes()


def test_seven_cameras_and_61_images_each(photos):
    assert len(CAMERAS) == 7
    items = _all(photos, per_band=5, per_damage=5, cameras=2)
    assert len(items) == 2 * (1 + BANDS * 5 + len(DAMAGES) * 5)  # 61 per camera
    assert len({m["camera_id"] for _, _, m in items}) == 2
    for cam in {m["camera_id"] for _, _, m in items}:
        mine = [m for _, _, m in items if m["camera_id"] == cam]
        assert sum(m["kind"] == "reference" for m in mine) == 1
        for b in range(BANDS):
            assert sum(m["kind"] == "band" and m["band"] == b for m in mine) == 5
        for d in DAMAGES:
            assert sum(m["damage"] == d for m in mine) == 5


def test_band_matches_fullness(photos):
    for _, _, m in _all(photos, per_band=2):
        if m["kind"] == "band":
            assert int(m["fullness_pct"] // 10) == m["band"]


def test_metadata_complete_and_labelled_synthetic(photos):
    for name, img, m in _all(photos, cameras=2):
        assert "synthetic" in name and m["synthetic"] is True
        assert img.size == (960, 720)
        for key in ("file", "camera_id", "base_photo", "kind", "band", "fullness_pct", "damage", "region",
                    "seed", "generator_version"):
            assert key in m
        if m["damage"] != "none":
            x0, y0, x1, y1 = m["region"]
            assert 0 <= x0 < x1 <= 960 and 0 <= y0 < y1 <= 720


def test_missing_photo_says_how_to_get_it(tmp_path):
    with pytest.raises(FileNotFoundError, match="extract_sample_photos"):
        next(generate(tmp_path))


def test_cli_writes_images_and_metadata(photos, tmp_path, monkeypatch):
    monkeypatch.setattr("sys.argv", ["x", "--photos", str(photos), "--out", str(tmp_path),
                                     "--per-band", "1", "--per-damage", "1"])
    main()
    meta = json.loads((tmp_path / "metadata.json").read_text())
    assert "SYNTHETIC" in meta["data_source"]
    assert all((tmp_path / m["file"]).exists() for m in meta["images"])
