from __future__ import annotations

import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art-source/brand/ghost-game/honru/cleanup-candidate-v1/alpha/honru-cleanup-candidate-v1-alpha.png"
DERIVED = ROOT / "art-source/brand/ghost-game/honru/cleanup-candidate-v1/derived"
EVIDENCE = ROOT / "requirements/active/production-readiness-sprint-p0-20260809/evidence/honru-cleanup-candidate-v1-audit.json"
SIZES = (44, 64, 96, 192)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def audit_image(image: Image.Image) -> dict:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    pixels = list(rgba.getdata())
    opaque = [pixel for pixel in pixels if pixel[3] >= 16]
    green = [pixel for pixel in opaque if pixel[1] > 160 and pixel[1] > pixel[0] * 1.45 and pixel[1] > pixel[2] * 1.45]
    corners = [rgba.getpixel((0, 0))[3], rgba.getpixel((rgba.width - 1, 0))[3], rgba.getpixel((0, rgba.height - 1))[3], rgba.getpixel((rgba.width - 1, rgba.height - 1))[3]]
    coverage = len(opaque) / max(1, rgba.width * rgba.height)
    return {
        "mode": rgba.mode,
        "width": rgba.width,
        "height": rgba.height,
        "alphaBoundingBox": list(bbox) if bbox else None,
        "cornerAlpha": corners,
        "opaqueCoverage": round(coverage, 6),
        "greenContaminationPixels": len(green),
        "greenContaminationRatio": round(len(green) / max(1, len(opaque)), 8),
        "technicalPass": bool(bbox and max(corners) == 0 and 0.18 <= coverage <= 0.75 and len(green) / max(1, len(opaque)) <= 0.001),
    }


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing source: {SOURCE}")
    DERIVED.mkdir(parents=True, exist_ok=True)
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    source_audit = audit_image(source)
    outputs = []
    bbox = source.getchannel("A").getbbox()
    subject = source.crop(bbox) if bbox else source
    for size in SIZES:
        padding = max(2, round(size * 0.06))
        available = size - padding * 2
        ratio = min(available / subject.width, available / subject.height)
        resized = subject.resize((max(1, round(subject.width * ratio)), max(1, round(subject.height * ratio))), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
        target = DERIVED / f"honru-cleanup-candidate-v1-{size}px.png"
        canvas.save(target, optimize=True)
        outputs.append({"path": target.relative_to(ROOT).as_posix(), "sha256": digest(target), **audit_image(canvas)})
    payload = {
        "schemaVersion": 1,
        "assetId": "honru-cleanup-candidate-v1",
        "status": "TECHNICAL_PASS" if source_audit["technicalPass"] and all(item["technicalPass"] for item in outputs) else "REWORK_REQUIRED",
        "boundary": "AI-assisted cleanup candidate; not human cleanup, Reviewer B, legal opinion, Golden Set approval, or runtime enablement",
        "source": {"path": SOURCE.relative_to(ROOT).as_posix(), "sha256": digest(SOURCE), **source_audit},
        "derived": outputs,
    }
    EVIDENCE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(payload["status"])
    print(EVIDENCE)


if __name__ == "__main__":
    main()
