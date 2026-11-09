"""Synthetic GPT net images made by EDITING the 7 council sample photos.

Each sample photo is one camera (cam-01 ... cam-07). For each camera this writes:
a clean reference, `per_band` images for each of 10 fullness bands (0-9% ... 90-100%),
`per_damage` images of `net_broken` and `per_damage` of `net_fallen` (5 each by default,
71 images per camera, 497 in all). The net position in each photo is a hand-marked polygon
(coordinates only, below). Debris is cut from the photo's own leaf litter, so colours match.

Everything written is SYNTHETIC and says so on the image, in the file name and in
`metadata.json`. The council photos are NOT committed and neither are the outputs
(`.local/` is gitignored). Faces and number plates are not checked: do not use the outputs
for training until that gate exists.

Run: python -m ml.synth_images [--seed 42] [--photos .local/sample-photos] [--out .local/synthetic-images]
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw

GENERATOR_VERSION = "synth-images-2"
BANDS = 10  # 0-9%, 10-19%, ... 90-100%
DAMAGES = ("net_broken", "net_fallen")

# Hand-marked, in the pixel space of the 960x720 sample photos. `poly` = where the net sits,
# `litter` = a patch of leaf litter in the same photo (or in `litter_photo` when this one has none),
# used as the debris texture.
# sample-5 already shows a fallen net on the ground (kept as is); sample-7 is a bar screen,
# its bars are treated as the net area; sample-1 and sample-2 have the net mostly hidden.
CAMERAS = [
    {"photo": "sample-1.jpg", "poly": [(458, 478), (520, 472), (545, 510), (520, 548), (470, 548)], "litter": (560, 520, 700, 640)},
    {"photo": "sample-2.jpg", "poly": [(462, 425), (525, 415), (535, 455), (510, 500), (462, 490)], "litter": (700, 150, 860, 300)},
    {"photo": "sample-3.jpg", "poly": [(472, 380), (588, 400), (622, 495), (590, 540), (487, 530), (478, 440)], "litter": (700, 300, 860, 420)},
    {"photo": "sample-4.jpg", "poly": [(415, 385), (520, 383), (548, 490), (735, 470), (750, 430), (700, 380), (530, 395)], "litter": (700, 250, 880, 380)},
    {"photo": "sample-5.jpg", "poly": [(388, 225), (430, 200), (475, 205), (478, 245), (430, 278), (395, 262)], "litter": (150, 120, 300, 200)},
    {"photo": "sample-6.jpg", "poly": [(320, 600), (385, 585), (425, 620), (420, 690), (305, 690)], "litter": (700, 300, 860, 420), "litter_photo": "sample-3.jpg"},
    {"photo": "sample-7.jpg", "poly": [(385, 395), (700, 445), (700, 570), (400, 500)], "litter": (420, 450, 640, 520)},
]
NET_DARK = (28, 30, 28)


def _mask(size, poly) -> Image.Image:
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return m


def _bbox(poly):
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    return int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))


def _with_mesh(img: Image.Image, poly, dark: float = 0.6) -> Image.Image:
    """Net mesh over `poly`: darkened area with a fine grid."""
    layer = Image.blend(img, Image.new("RGB", img.size, NET_DARK), dark)
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = _bbox(poly)
    for x in range(x0, x1, 8):
        d.line([(x, y0), (x, y1)], fill=(150, 155, 150), width=1)
    for y in range(y0, y1, 8):
        d.line([(x0, y), (x1, y)], fill=(150, 155, 150), width=1)
    out = img.copy()
    out.paste(layer, mask=_mask(img.size, poly))
    return out


def _debris(img: Image.Image, litter_src: Image.Image, cam: dict, rng: np.random.Generator, fullness: float) -> Image.Image:
    """Fill the net from the bottom with debris cut from the photo's own litter."""
    if fullness <= 0:
        return img
    x0, y0, x1, y1 = _bbox(cam["poly"])
    bw, bh = x1 - x0, y1 - y0
    tex = litter_src.crop(cam["litter"])
    if rng.random() < 0.5:
        tex = tex.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    tex = ImageChops.multiply(tex.resize((bw, bh)), Image.new("RGB", (bw, bh), (int(rng.integers(215, 256)),) * 3))
    layer = img.copy()
    layer.paste(tex, (x0, y0))
    top = y1 - fullness * bh
    ragged = np.clip(np.cumsum(rng.normal(0, 1.2, bw)), -0.08 * bh, 0.08 * bh)
    fill = np.zeros((img.size[1], img.size[0]), np.uint8)
    for i in range(bw):
        fill[max(0, int(top + ragged[i])):y1, x0 + i] = 255
    mask = ImageChops.multiply(_mask(img.size, cam["poly"]), Image.fromarray(fill))
    out = img.copy()
    out.paste(layer, mask=mask)
    return out


def render(base: Image.Image, cam: dict, rng: np.random.Generator, fullness: float, damage: str, light: float,
           litter_src: Image.Image | None = None):
    """Return (image, region). Region is [x0, y0, x1, y1] of debris or damage, else None."""
    w, h = base.size
    poly = cam["poly"]
    x0, y0, x1, y1 = _bbox(poly)
    region = None
    if damage == "net_fallen":
        img = Image.composite(Image.new("RGB", base.size, NET_DARK), base, _mask(base.size, poly).point(lambda v: int(v * 0.85)))
        bw, bh = x1 - x0, y1 - y0
        dx = int(bw * 0.9) if x1 + bw * 1.1 < w else -int(bw * 0.9)
        dy = min(int(bh * 0.6), h - 40 - y1)
        moved = [(px + dx, py + dy) for px, py in poly]
        img = _with_mesh(img, moved, 0.45)
        ImageDraw.Draw(img).polygon(moved, outline=(180, 185, 180))
        region = list(_bbox(moved))
    else:
        img = _with_mesh(base, poly)
        img = _debris(img, litter_src or base, cam, rng, fullness)
        if fullness > 0:
            region = [x0, int(y1 - fullness * (y1 - y0)), x1, y1]
        if damage == "net_broken":
            bw, bh = x1 - x0, y1 - y0
            hw, hh = int(bw * rng.uniform(0.3, 0.45)), int(bh * rng.uniform(0.3, 0.45))
            hx, hy = x0 + int(rng.integers(0, max(1, bw - hw))), y0 + int(rng.integers(0, max(1, bh - hh)))
            hole = [(hx, hy + hh // 3), (hx + hw // 2, hy), (hx + hw, hy + hh // 4), (hx + hw * 9 // 10, hy + hh),
                    (hx + hw // 3, hy + hh * 9 // 10)]
            m = _mask(base.size, hole)
            m = ImageChops.multiply(m, _mask(base.size, poly))
            img = Image.composite(Image.new("RGB", base.size, (14, 15, 14)), img, m)
            ImageDraw.Draw(img).line(hole + [hole[0]], fill=(170, 175, 170), width=1)
            region = [hx, hy, hx + hw, hy + hh]
    arr = np.asarray(img, float) * light + rng.normal(0, 2, (h, w, 3))
    img = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 330, 18), fill=(20, 20, 20))
    d.text((6, 3), "SYNTHETIC EDIT of a sample photo - not a real reading", fill=(255, 255, 255))
    return img, region


def generate(photo_dir, seed: int = 42, per_band: int = 5, per_damage: int = 5, cameras: int | None = None):
    """Yield (filename, image, metadata) for every synthetic image of the first `cameras` cameras (all 7)."""
    photo_dir = Path(photo_dir)
    for c, cam in enumerate(CAMERAS[:cameras]):
        path = photo_dir / cam["photo"]
        if not path.exists():
            raise FileNotFoundError(f"{path} missing: run `python scripts/extract_sample_photos.py` first")
        base = Image.open(path).convert("RGB")
        litter_src = Image.open(photo_dir / cam["litter_photo"]).convert("RGB") if "litter_photo" in cam else None
        cam_id = f"cam-{c + 1:02d}"
        jobs = [("reference", None, 0.0, "none")]
        jobs += [("band", b, None, "none") for b in range(BANDS) for _ in range(per_band)]
        jobs += [("damage", None, None, dmg) for dmg in DAMAGES for _ in range(per_damage)]
        for i, (kind, band, fullness, damage) in enumerate(jobs):
            rng = np.random.default_rng([seed, c, i + 1])
            if kind == "band":
                fullness = (band + rng.uniform(0, 0.999)) / BANDS
            elif kind == "damage":
                fullness = float(rng.uniform(0, 0.3)) if damage == "net_broken" else 0.0
            light = 1.0 if kind == "reference" else float(rng.uniform(0.85, 1.1))
            img, region = render(base, cam, rng, fullness, damage, light, litter_src)
            tag = f"b{band}" if kind == "band" else (damage if kind == "damage" else "reference")
            name = f"synthetic_{cam_id}_{tag}_{i:03d}.png"
            meta = {
                "file": name, "camera_id": cam_id, "base_photo": cam["photo"], "synthetic": True, "kind": kind,
                "band": min(BANDS - 1, int(fullness * BANDS)), "fullness_pct": round(fullness * 100, 1),
                "damage": damage, "region": region, "light": round(light, 3),
                "seed": seed, "generator_version": GENERATOR_VERSION,
            }
            if damage == "net_fallen":
                meta["band"], meta["fullness_pct"] = None, None  # net is not in place
            yield name, img, meta


def main() -> None:
    p = argparse.ArgumentParser(description="Write SYNTHETIC GPT net images from the sample photos (not real data).")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--photos", default=".local/sample-photos")
    p.add_argument("--out", default=".local/synthetic-images")
    p.add_argument("--per-band", type=int, default=5)
    p.add_argument("--per-damage", type=int, default=5)
    a = p.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    metas = []
    for name, img, meta in generate(a.photos, a.seed, a.per_band, a.per_damage):
        img.save(out / name)
        metas.append(meta)
    (out / "metadata.json").write_text(json.dumps(
        {"data_source": "SYNTHETIC edits of 7 council sample photos, not real readings",
         "generator_version": GENERATOR_VERSION, "seed": a.seed, "images": metas}, indent=2))
    print(f"wrote {len(metas)} synthetic images to {out}")


if __name__ == "__main__":
    main()
