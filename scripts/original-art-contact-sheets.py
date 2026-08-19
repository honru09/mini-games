#!/usr/bin/env python3
"""Create review-only contact sheets for the 14 frozen original art families."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import textwrap
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


FAMILIES = [
    ("honru-v2", "art-source/brand/ghost-game/honru/v2"),
    ("honru-cleanup", "art-source/brand/ghost-game/honru/cleanup-candidate-v1"),
    ("honru-states", "art-source/brand/ghost-game/honru/states-v1"),
    ("honru-emoji", "art-source/brand/ghost-game/honru/emoji-v1"),
    ("gcoins", "art-source/brand/ghost-game/currency"),
    ("honru-pixel-avatar", "art-source/platform/avatars/v3-honru-pixel-p0-20260811"),
    ("player-character", "art-source/player-character/art-036-player-character-monopoly-p1-20260810"),
    ("monopoly", "art-source/games/monopoly/art-036-player-character-monopoly-p1-20260810"),
    ("tank", "art-source/games/tank/tank-art-p1-20260810"),
    ("m0-teacher", "art-source/ai/teacher/sticker-v1"),
    ("m0-avatar", "art-source/avatars/golden-set/sticker-v1"),
    ("m0-ui", "art-source/ui/sticker-v1"),
    ("m0-gomoku", "art-source/games/gomoku/sticker-v1"),
    ("m0-ludo", "art-source/games/ludo/sticker-v1"),
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def open_review_image(path: Path):
    if path.suffix.lower() != ".png":
        return None
    with Image.open(path) as source:
        source.load()
        return source.convert("RGBA")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    root = Path(args.root).resolve()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default()
    manifest = {
        "schemaVersion": 1,
        "createdAt": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "mode": "REVIEW_ONLY_DERIVED_CONTACT_SHEETS",
        "families": [],
    }

    for family_id, relative_root in FAMILIES:
        family_root = root / relative_root
        all_files = sorted((path for path in family_root.rglob("*") if path.is_file()), key=lambda p: p.as_posix().casefold())
        visual_files = [path for path in all_files if path.suffix.lower() in {".png", ".svg"}]
        all_file_records = []
        for path in all_files:
            file_record = {
                "path": path.relative_to(root).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
                "extension": path.suffix.lower(),
            }
            if path.suffix.lower() in {".md", ".json", ".html"}:
                text = path.read_text(encoding="utf-8-sig", errors="replace")
                file_record["textRead"] = True
                file_record["lines"] = len(text.splitlines())
                file_record["headings"] = sum(1 for line in text.splitlines() if line.lstrip().startswith("#"))
            all_file_records.append(file_record)
        records = []
        thumbnails = []
        for path in visual_files:
            relative = path.relative_to(root).as_posix()
            record = {"path": relative, "bytes": path.stat().st_size, "sha256": sha256(path), "extension": path.suffix.lower()}
            try:
                image = open_review_image(path)
                if image is not None:
                    record.update({"width": image.width, "height": image.height, "mode": image.mode})
                    thumbnails.append((path, image, record))
                else:
                    record["renderedInContactSheet"] = False
                    record["reason"] = "SVG preserved as source text; visual PNG siblings exist for this family."
            except Exception as error:
                record["renderedInContactSheet"] = False
                record["reason"] = f"{type(error).__name__}: {error}"
            records.append(record)

        tile_width, tile_height = 250, 290
        columns = min(6, max(1, math.ceil(math.sqrt(max(1, len(thumbnails))))))
        rows = math.ceil(max(1, len(thumbnails)) / columns)
        sheet = Image.new("RGB", (columns * tile_width, rows * tile_height), "#dedede")
        draw = ImageDraw.Draw(sheet)
        for index, (path, image, record) in enumerate(thumbnails):
            x = (index % columns) * tile_width
            y = (index // columns) * tile_height
            checker = Image.new("RGB", (tile_width - 16, 210), "white")
            checker_draw = ImageDraw.Draw(checker)
            for cy in range(0, checker.height, 16):
                for cx in range(0, checker.width, 16):
                    if (cx // 16 + cy // 16) % 2:
                        checker_draw.rectangle((cx, cy, cx + 15, cy + 15), fill="#e7e7e7")
            preview = image.copy()
            preview.thumbnail((checker.width - 10, checker.height - 10), Image.Resampling.LANCZOS)
            px = (checker.width - preview.width) // 2
            py = (checker.height - preview.height) // 2
            checker.paste(preview, (px, py), preview)
            sheet.paste(checker, (x + 8, y + 8))
            name = path.relative_to(family_root).as_posix()
            label = "\n".join(textwrap.wrap(name, width=36)[:3])
            draw.multiline_text((x + 8, y + 224), label, fill="black", font=font, spacing=2)
            draw.text((x + 8, y + 270), f"{record.get('width','?')}x{record.get('height','?')} {record['sha256'][:10]}", fill="#333", font=font)
            record["renderedInContactSheet"] = True

        sheet_path = output / f"original-{family_id}-all-images-contact-sheet.jpg"
        sheet.save(sheet_path, quality=90, optimize=True)
        manifest["families"].append({
            "id": family_id,
            "root": relative_root,
            "fileCount": len(all_files),
            "visualFileCount": len(visual_files),
            "rasterRenderedCount": len(thumbnails),
            "contactSheet": sheet_path.relative_to(root).as_posix(),
            "contactSheetSha256": sha256(sheet_path),
            "files": all_file_records,
            "records": records,
        })

    manifest["totals"] = {
        "families": len(manifest["families"]),
        "files": sum(item["fileCount"] for item in manifest["families"]),
        "visualFiles": sum(item["visualFileCount"] for item in manifest["families"]),
        "rasterRendered": sum(item["rasterRenderedCount"] for item in manifest["families"]),
        "textFilesRead": sum(sum(1 for record in item["files"] if record.get("textRead")) for item in manifest["families"]),
        "markdownDocumentsRead": sum(sum(1 for record in item["files"] if record.get("textRead") and record["extension"] == ".md") for item in manifest["families"]),
        "htmlFilesRead": sum(sum(1 for record in item["files"] if record.get("textRead") and record["extension"] == ".html") for item in manifest["families"]),
    }
    manifest["boundary"] = [
        "Contact sheets are derived review evidence and do not alter source assets.",
        "Every PNG is shown with its relative path and hash prefix; SVG files retain full-file hashes and are not silently rasterized.",
        "Visible review is not human cleanup, Reviewer B, IP approval, Golden Set approval, or runtime authorization.",
    ]
    manifest_path = output / "original-14-family-complete-visual-inventory-20260814.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": str(manifest_path), **manifest["totals"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
