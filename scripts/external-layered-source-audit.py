#!/usr/bin/env python3
"""Read-only structural inventory for external PSD/AI/EPS reference assets.

The script never extracts archive members or modifies the source trees. It reads
PSD layer records without decoding pixels and scans Illustrator/PostScript streams
for document-structure markers. The result is evidence for inventory completeness,
not a license, IP, quality, or Golden Set decision.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import struct
import sys
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


VECTOR_PATTERNS = {
    "pdfObjects": re.compile(rb"(?<!\d)\d+\s+\d+\s+obj\b"),
    "pdfPages": re.compile(rb"/Type\s*/Page(?!s)\b"),
    "pdfXObjects": re.compile(rb"/Type\s*/XObject\b"),
    "pdfImages": re.compile(rb"/Subtype\s*/Image\b"),
    "pdfFonts": re.compile(rb"/Type\s*/Font\b"),
    "pdfOptionalContentGroups": re.compile(rb"/Type\s*/OCG\b"),
    "postscriptPages": re.compile(rb"(?m)^%%Page:\s"),
    "illustratorLayerBegins": re.compile(rb"(?m)^%(?:AI\d+_)?BeginLayer\b"),
    "illustratorLayerEnds": re.compile(rb"(?m)^%(?:AI\d+_)?EndLayer\b"),
    "illustratorObjectBegins": re.compile(rb"(?m)^%(?:AI\d+_)?BeginObject\b"),
    "illustratorPlacedBegins": re.compile(rb"(?m)^%(?:AI\d+_)?BeginPlaced\b"),
    "documentFonts": re.compile(rb"(?m)^%%DocumentFonts:\s"),
    "boundingBoxes": re.compile(rb"(?m)^%%(?:HiRes)?BoundingBox:\s"),
}


class PsdParseError(RuntimeError):
    pass


def read_exact(stream, size: int) -> bytes:
    value = stream.read(size)
    if len(value) != size:
        raise PsdParseError(f"unexpected EOF: wanted {size}, got {len(value)}")
    return value


def u16(stream) -> int:
    return struct.unpack(">H", read_exact(stream, 2))[0]


def i16(stream) -> int:
    return struct.unpack(">h", read_exact(stream, 2))[0]


def u32(stream) -> int:
    return struct.unpack(">I", read_exact(stream, 4))[0]


def i32(stream) -> int:
    return struct.unpack(">i", read_exact(stream, 4))[0]


def u64(stream) -> int:
    return struct.unpack(">Q", read_exact(stream, 8))[0]


def decode_pascal_name(extra: io.BytesIO) -> str:
    start = extra.tell()
    length_bytes = extra.read(1)
    if not length_bytes:
        return ""
    length = length_bytes[0]
    raw = extra.read(length)
    consumed = 1 + length
    extra.seek(start + ((consumed + 3) // 4) * 4)
    return raw.decode("macroman", errors="replace")


def parse_layer_extra(data: bytes) -> dict:
    stream = io.BytesIO(data)
    result = {
        "name": "",
        "unicodeName": None,
        "sectionType": 0,
        "tagKeys": [],
    }
    try:
        mask_length = u32(stream)
        stream.seek(mask_length, io.SEEK_CUR)
        blend_length = u32(stream)
        stream.seek(blend_length, io.SEEK_CUR)
        result["name"] = decode_pascal_name(stream)
    except (PsdParseError, ValueError):
        return result

    while stream.tell() + 12 <= len(data):
        signature = stream.read(4)
        if signature not in (b"8BIM", b"8B64"):
            break
        key = stream.read(4)
        size = u32(stream)
        remaining = len(data) - stream.tell()
        if size > remaining:
            break
        payload = stream.read(size)
        if size % 2 and stream.tell() < len(data):
            stream.read(1)
        key_text = key.decode("latin-1", errors="replace")
        result["tagKeys"].append(key_text)
        if key == b"luni" and len(payload) >= 4:
            chars = struct.unpack(">I", payload[:4])[0]
            raw = payload[4 : 4 + chars * 2]
            result["unicodeName"] = raw.decode("utf-16-be", errors="replace")
        elif key in (b"lsct", b"lsdk") and len(payload) >= 4:
            result["sectionType"] = struct.unpack(">I", payload[:4])[0]
    return result


def parse_psd(stream, label: str, byte_size: int) -> dict:
    signature = read_exact(stream, 4)
    if signature != b"8BPS":
        raise PsdParseError(f"unsupported signature {signature!r}")
    version = u16(stream)
    if version not in (1, 2):
        raise PsdParseError(f"unsupported PSD version {version}")
    read_exact(stream, 6)
    channels = u16(stream)
    height = u32(stream)
    width = u32(stream)
    depth = u16(stream)
    color_mode = u16(stream)
    color_data = u32(stream)
    stream.seek(color_data, io.SEEK_CUR)
    resources = u32(stream)
    stream.seek(resources, io.SEEK_CUR)
    layer_mask_length = u64(stream) if version == 2 else u32(stream)
    layer_mask_start = stream.tell()
    if layer_mask_length == 0:
        return {
            "path": label,
            "bytes": byte_size,
            "version": version,
            "width": width,
            "height": height,
            "channels": channels,
            "depth": depth,
            "colorMode": color_mode,
            "layers": 0,
            "groups": 0,
            "hiddenLayers": 0,
            "textLayers": 0,
            "smartObjects": 0,
            "vectorMasks": 0,
            "shapeLayers": 0,
            "adjustmentLayers": 0,
            "names": [],
            "tagKeys": {},
        }
    layer_info_length = u64(stream) if version == 2 else u32(stream)
    if layer_info_length == 0:
        layer_count = 0
    else:
        layer_count = abs(i16(stream))
    counters = Counter()
    names = []
    tag_keys = Counter()
    adjustment_keys = {
        "levl", "curv", "brit", "blnc", "hue2", "hue ", "selc", "mixr",
        "grdm", "phfl", "expA", "vibA", "blwh", "clrL", "nvrt", "thrs", "post",
    }
    for _ in range(layer_count):
        top, left, bottom, right = i32(stream), i32(stream), i32(stream), i32(stream)
        channel_count = u16(stream)
        for _channel in range(channel_count):
            read_exact(stream, 2)
            u64(stream) if version == 2 else u32(stream)
        read_exact(stream, 4)
        read_exact(stream, 4)
        read_exact(stream, 1)
        read_exact(stream, 1)
        flags = read_exact(stream, 1)[0]
        read_exact(stream, 1)
        extra_length = u32(stream)
        extra = parse_layer_extra(read_exact(stream, extra_length))
        keys = set(extra["tagKeys"])
        tag_keys.update(keys)
        name = extra["unicodeName"] or extra["name"]
        if name:
            names.append(name)
        if flags & 0x02:
            counters["hiddenLayers"] += 1
        if extra["sectionType"] in (1, 2):
            counters["groups"] += 1
        if "TySh" in keys or "Txt2" in keys:
            counters["textLayers"] += 1
        if keys.intersection({"SoLd", "SoLE", "plLd", "lnkD", "lnk2", "lnk3"}):
            counters["smartObjects"] += 1
        if keys.intersection({"vmsk", "vsms"}):
            counters["vectorMasks"] += 1
        if keys.intersection({"vscg", "vogk"}):
            counters["shapeLayers"] += 1
        if keys.intersection(adjustment_keys):
            counters["adjustmentLayers"] += 1
        if bottom > top and right > left:
            counters["nonEmptyBounds"] += 1
    if stream.tell() > layer_mask_start + layer_mask_length + 16:
        raise PsdParseError("layer records exceeded declared layer/mask section")
    return {
        "path": label,
        "bytes": byte_size,
        "version": version,
        "width": width,
        "height": height,
        "channels": channels,
        "depth": depth,
        "colorMode": color_mode,
        "layers": layer_count,
        "groups": counters["groups"],
        "hiddenLayers": counters["hiddenLayers"],
        "textLayers": counters["textLayers"],
        "smartObjects": counters["smartObjects"],
        "vectorMasks": counters["vectorMasks"],
        "shapeLayers": counters["shapeLayers"],
        "adjustmentLayers": counters["adjustmentLayers"],
        "nonEmptyBounds": counters["nonEmptyBounds"],
        "names": names,
        "tagKeys": dict(sorted(tag_keys.items())),
    }


def scan_vector_stream(stream, label: str, extension: str, byte_size: int) -> dict:
    counts = Counter()
    sha256 = hashlib.sha256()
    first = b""
    carry = b""
    while True:
        chunk = stream.read(1024 * 1024)
        if not chunk:
            break
        sha256.update(chunk)
        if not first:
            first = chunk[:64]
        sample = carry + chunk
        carry_size = len(carry)
        for key, pattern in VECTOR_PATTERNS.items():
            counts[key] += sum(1 for match in pattern.finditer(sample) if match.end() > carry_size)
        carry = sample[-512:]
    return {
        "path": label,
        "extension": extension,
        "bytes": byte_size,
        "sha256": sha256.hexdigest(),
        "container": (
            "pdf-compatible" if first.startswith(b"%PDF-")
            else "postscript" if first.startswith(b"%!")
            else "binary-eps-wrapper" if first.startswith(bytes.fromhex("c5d0d3c6"))
            else "unknown"
        ),
        **{key: counts[key] for key in VECTOR_PATTERNS},
    }


def aggregate(records: list[dict], fields: list[str]) -> dict:
    output = {"files": len(records), "bytes": sum(item.get("bytes", 0) for item in records)}
    for field in fields:
        output[field] = sum(item.get(field, 0) for item in records)
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ui-root", required=True)
    parser.add_argument("--rpg-root", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    ui_root = Path(args.ui_root).resolve()
    rpg_root = Path(args.rpg_root).resolve()
    output = Path(args.output).resolve()

    psd_records = []
    vector_records = []
    failures = []

    ui_files = sorted((path for path in ui_root.rglob("*") if path.is_file()), key=lambda p: p.as_posix().casefold())
    for index, path in enumerate(ui_files, 1):
        extension = path.suffix.lower()
        if extension not in {".psd", ".ai", ".eps"}:
            continue
        label = "q-ui-pack/" + path.relative_to(ui_root).as_posix()
        try:
            with path.open("rb") as stream:
                if extension == ".psd":
                    psd_records.append(parse_psd(stream, label, path.stat().st_size))
                else:
                    vector_records.append(scan_vector_stream(stream, label, extension, path.stat().st_size))
        except Exception as error:  # Evidence must retain every unsupported/corrupt file.
            failures.append({"path": label, "extension": extension, "errorType": type(error).__name__, "error": str(error)[:500]})
        if index % 25 == 0:
            print(f"ui {index}/{len(ui_files)}", flush=True)

    zip_files = sorted(rpg_root.glob("*.zip"), key=lambda p: p.name.casefold())
    for zip_index, archive_path in enumerate(zip_files, 1):
        with zipfile.ZipFile(archive_path) as archive:
            members = sorted((item for item in archive.infolist() if not item.is_dir()), key=lambda i: i.filename.casefold())
            for item in members:
                extension = Path(item.filename).suffix.lower()
                if extension not in {".psd", ".ai", ".eps"}:
                    continue
                label = f"rpg-pack/{archive_path.name}!/{item.filename}"
                try:
                    with archive.open(item) as stream:
                        if extension == ".psd":
                            psd_records.append(parse_psd(io.BytesIO(stream.read()), label, item.file_size))
                        else:
                            vector_records.append(scan_vector_stream(stream, label, extension, item.file_size))
                except Exception as error:
                    failures.append({"path": label, "extension": extension, "errorType": type(error).__name__, "error": str(error)[:500]})
        print(f"zip {zip_index}/{len(zip_files)} {archive_path.name}", flush=True)

    psd_fields = ["layers", "groups", "hiddenLayers", "textLayers", "smartObjects", "vectorMasks", "shapeLayers", "adjustmentLayers", "nonEmptyBounds"]
    vector_fields = list(VECTOR_PATTERNS)
    result = {
        "schemaVersion": 1,
        "createdAt": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "mode": "READ_ONLY_NO_EXTRACTION",
        "sourceRoots": {
            "qUiPack": ui_root.as_posix(),
            "rpgCharacterPack": rpg_root.as_posix(),
        },
        "scope": {
            "uiFilesVisited": len(ui_files),
            "rpgZipFilesVisited": len(zip_files),
            "psdExpected": 288,
            "aiExpected": 361,
            "epsExpected": 3170,
            "expectedLayeredOrVectorFiles": 3819,
        },
        "psd": {
            "summary": aggregate(psd_records, psd_fields),
            "records": psd_records,
        },
        "vector": {
            "summary": aggregate(vector_records, vector_fields),
            "containerCounts": dict(sorted(Counter(item["container"] for item in vector_records).items())),
            "extensionCounts": dict(sorted(Counter(item["extension"] for item in vector_records).items())),
            "records": vector_records,
        },
        "failures": failures,
        "completion": {
            "parsedOrRecorded": len(psd_records) + len(vector_records) + len(failures),
            "successfullyParsed": len(psd_records) + len(vector_records),
            "failed": len(failures),
        },
        "interpretationBoundary": [
            "PSD layer records, names, groups and tagged feature markers were read without decoding or exporting pixels.",
            "AI/EPS streams were read completely and inventoried by PDF/PostScript/Illustrator structural markers; proprietary Illustrator semantic objects are not reconstructed.",
            "The inventory does not grant a license, prove originality, approve visual quality, or authorize runtime/generation use.",
            "No archive member was extracted to disk and no source asset was modified.",
        ],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "psd": len(psd_records), "vectors": len(vector_records), "failures": len(failures)}, ensure_ascii=False), flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
