"""Synthetic GPT net images. Everything written here is SYNTHETIC, not real camera data.

Per synthetic camera: one clean reference, `per_band` images for each of 10 fullness bands
(0-9% ... 90-100%), and `per_damage` images each of `net_broken` and `net_fallen`.
Same seed gives the same pixels. `metadata.json` records the true band, damage and region
of every image, so ticket 22 can check its annotation against known answers.

The 7 council sample photos were checked as a base: they are cluttered, differently angled
scenes (and not ours to commit), so the scene is drawn procedurally instead.

Run: python -m ml.synth_images [--seed 42] [--out .local/synthetic-images]
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

GENERATOR_VERSION = "synth-images-1"
W, H = 640, 480
BANDS = 10  # 0-9%, 10-19%, ... 90-100%
DAMAGES = ("net_broken", "net_fallen")
LEAF_COLOURS = [(120, 82, 40), (150, 105, 50), (96, 110, 48), (170, 125, 60), (110, 70, 35)]


def _camera(seed: int, cam: int) -> dict:
    """Fixed scene for one synthetic camera: background plus where the net sits."""
    rng = np.random.default_rng([seed, cam, 0])
    nw = int(rng.integers(190, 250))
    nh = int(rng.integers(110, 150))
    x0 = int(rng.integers(150, W - nw - 100))
    y0 = int(rng.integers(230, H - nh - 60))
    low = rng.normal(0, 1, (H // 40 + 2, W // 40 + 2))
    noise = np.kron(low, np.ones((40, 40)))[:H, :W]
    base = np.array([rng.integers(70, 100), rng.integers(110, 140), rng.integers(50, 75)], float)
    bg = np.clip(base + noise[..., None] * 12 + rng.normal(0, 4, (H, W, 3)), 0, 255)
    path_y = int(rng.integers(40, 120))
    bg[:path_y, :] = np.array([150, 150, 148]) + noise[:path_y, :, None] * 6
    return {"id": f"synthetic-cam-{cam + 1:02d}", "bg": bg, "net": (x0, y0, x0 + nw, y0 + nh)}


def _leaf(d: ImageDraw.ImageDraw, rng: np.random.Generator, cx: float, cy: float, size: float) -> None:
    ang = rng.uniform(0, math.pi)
    a, b = size, size * 0.45
    pts = [(cx + a * math.cos(t) * math.cos(ang) - b * math.sin(t) * math.sin(ang),
            cy + a * math.cos(t) * math.sin(ang) + b * math.sin(t) * math.cos(ang))
           for t in np.linspace(0, 2 * math.pi, 10, endpoint=False)]
    d.polygon(pts, fill=LEAF_COLOURS[int(rng.integers(len(LEAF_COLOURS)))])


def _mesh(d: ImageDraw.ImageDraw, box: tuple) -> None:
    x0, y0, x1, y1 = box
    d.rectangle(box, outline=(70, 75, 80), width=5)
    for x in range(x0 + 12, x1, 12):
        d.line([(x, y0 + 5), (x, y1 - 5)], fill=(110, 115, 120), width=1)
    for y in range(y0 + 12, y1, 12):
        d.line([(x0 + 5, y), (x1 - 5, y)], fill=(110, 115, 120), width=1)


def render(cam: dict, rng: np.random.Generator, fullness: float, damage: str, light: float):
    """Return (image, region). Region is [x0, y0, x1, y1] of debris or damage, else None."""
    img = Image.fromarray(cam["bg"].astype("uint8"))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = cam["net"]
    nw, nh = x1 - x0, y1 - y0
    d.rectangle(cam["net"], fill=(35, 38, 36))  # dark opening of the pit
    region = None
    if damage == "net_fallen":
        # net lies on the ground beside its frame; the opening is empty
        gx, gy = x1 + 15, y0 + int(nh * 0.5)
        pts = [(gx, gy), (gx + nw * 0.8, gy - nh * 0.25), (gx + nw * 0.8, gy + nh * 0.35), (gx, gy + nh * 0.6)]
        d.polygon(pts, fill=(95, 100, 105), outline=(60, 65, 70))
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        region = [max(0, int(min(xs))), max(0, int(min(ys))), min(W, int(max(xs))), min(H, int(max(ys)))]  # clipped to the frame
    else:
        if fullness > 0:
            top = min(y1 - fullness * (nh - 8), y1 - 5)
            d.rectangle((x0 + 4, top, x1 - 4, y1 - 4), fill=(105, 72, 36))
            for _ in range(int(40 + 260 * fullness)):
                _leaf(d, rng, rng.uniform(x0 + 6, x1 - 6), rng.uniform(top - 4, y1 - 6), rng.uniform(6, 11))
            region = [x0, int(top), x1, y1]
        skip = None
        if damage == "net_broken":
            hw, hh = int(nw * rng.uniform(0.25, 0.4)), int(nh * rng.uniform(0.4, 0.6))
            hx, hy = x0 + int(rng.integers(8, nw - hw - 8)), y0 + int(rng.integers(8, nh - hh - 8))
            skip = (hx, hy, hx + hw, hy + hh)
            region = list(skip)
        _mesh(d, cam["net"])
        if skip:
            d.rectangle(skip, fill=(35, 38, 36))
            for k in range(3):  # torn wires hanging into the hole
                sx = skip[0] + (k + 1) * (skip[2] - skip[0]) // 4
                d.line([(sx, skip[1]), (sx + int(rng.integers(-8, 8)), skip[1] + 18)], fill=(130, 135, 140), width=2)
    for _ in range(int(rng.integers(0, 6))):  # a few stray leaves on the ground
        _leaf(d, rng, rng.uniform(0, W), rng.uniform(H * 0.5, H - 40), rng.uniform(5, 9))
    arr = np.asarray(img, float) * light + rng.normal(0, 3, (H, W, 3))
    img = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
    d = ImageDraw.Draw(img)
    d.rectangle((0, H - 28, W, H), fill=(20, 20, 20))
    d.text((8, H - 22), f"SYNTHETIC IMAGE - not a real camera - {cam['id']}", fill=(255, 255, 255))
    return img, region


def generate(seed: int = 42, cameras: int = 3, per_band: int = 5, per_damage: int = 5):
    """Yield (filename, image, metadata) for every synthetic image."""
    for c in range(cameras):
        cam = _camera(seed, c)
        jobs = [("reference", None, 0.0, "none")]
        jobs += [("band", b, None, "none") for b in range(BANDS) for _ in range(per_band)]
        jobs += [("damage", None, None, dmg) for dmg in DAMAGES for _ in range(per_damage)]
        for i, (kind, band, fullness, damage) in enumerate(jobs):
            rng = np.random.default_rng([seed, c, i + 1])
            if kind == "band":
                fullness = (band + rng.uniform(0, 0.999)) / BANDS
            elif kind == "damage":
                fullness = float(rng.uniform(0, 0.3)) if damage == "net_broken" else 0.0
            light = 1.0 if kind == "reference" else float(rng.uniform(0.75, 1.15))
            img, region = render(cam, rng, fullness, damage, light)
            name = f"synthetic_{cam['id'][-2:]}_{kind}{'' if band is None else f'_b{band}'}{'' if damage == 'none' else f'_{damage}'}_{i:03d}.png"
            meta = {
                "file": name, "camera_id": cam["id"], "synthetic": True, "kind": kind,
                "band": min(BANDS - 1, int(fullness * BANDS)), "fullness_pct": round(fullness * 100, 1),
                "damage": damage, "region": region, "light": round(light, 3),
                "seed": seed, "generator_version": GENERATOR_VERSION,
            }
            if damage == "net_fallen":
                meta["band"], meta["fullness_pct"] = None, None  # net is not in place
            yield name, img, meta


def main() -> None:
    p = argparse.ArgumentParser(description="Write SYNTHETIC GPT net images (not real data).")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--out", default=".local/synthetic-images")
    p.add_argument("--cameras", type=int, default=3)
    p.add_argument("--per-band", type=int, default=5)
    p.add_argument("--per-damage", type=int, default=5)
    a = p.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    metas = []
    for name, img, meta in generate(a.seed, a.cameras, a.per_band, a.per_damage):
        img.save(out / name)
        metas.append(meta)
    (out / "metadata.json").write_text(json.dumps(
        {"data_source": "SYNTHETIC images, not real camera data", "generator_version": GENERATOR_VERSION,
         "seed": a.seed, "images": metas}, indent=2))
    print(f"wrote {len(metas)} synthetic images to {out}")


if __name__ == "__main__":
    main()
