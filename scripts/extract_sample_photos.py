"""Extract the 7 sample camera photos from the council briefing PDF for the local photo review page.

Writes .local/sample-photos/sample-1.jpg .. sample-7.jpg (gitignored, never commit them).
They are on pages 16 to 22 of reference/parramatta-possibilities-challenge-briefing.pdf.

Needs pypdf and pillow (not project dependencies, install in a throwaway venv):
    python3 -m venv /tmp/pdfvenv && /tmp/pdfvenv/bin/pip install pypdf pillow
    /tmp/pdfvenv/bin/python -I scripts/extract_sample_photos.py
"""

from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "reference" / "parramatta-possibilities-challenge-briefing.pdf"
OUT = ROOT / ".local" / "sample-photos"
FIRST_PAGE, LAST_PAGE = 16, 22  # 1-based, inclusive


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(PDF)
    for n, page_no in enumerate(range(FIRST_PAGE, LAST_PAGE + 1), start=1):
        image = reader.pages[page_no - 1].images[0].image.convert("RGB")
        image.resize((960, 720)).save(OUT / f"sample-{n}.jpg", quality=85)
        print(f"page {page_no} -> {OUT / f'sample-{n}.jpg'}")


if __name__ == "__main__":
    main()
