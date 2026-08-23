"""Build P2-01 Ghost-native seasonal premium background derivatives.

Authoring-time only. Runtime remains the existing zero-dependency Premium
Background presentation path; this script does not implement seasons,
Battle Pass, Remote Config, rewards, or social ranking.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "art-source" / "platform" / "backgrounds" / "seasonal-v1"
MASTER_ROOT = SOURCE_ROOT / "source"
RUNTIME_ROOT = ROOT / "public" / "assets" / "backgrounds" / "seasonal-v1"
FAMILY_CATALOG = RUNTIME_ROOT / "background_catalog_v1.json"
GLOBAL_MANIFEST = ROOT / "public" / "assets" / "manifests" / "asset_manifest.json"
ASSET_LIBRARY = ROOT / "asset-library" / "catalog.json"
FLAG = "mg_art_seasonal_backgrounds_v1"
FAMILY_ID = "P-SEASONAL-BACKGROUNDS-V1"
SOURCE_ASSET_ID = "ART-SEASONAL-BACKGROUNDS-V1"

SEASONS = [
    {
        "season": "spring",
        "master": "spring-signal-garden-master-v1.png",
        "staticId": 32,
        "animatedId": 33,
        "staticName": "春日信号花园",
        "animatedName": "春风巡游·动态",
        "overlay": "rgba(37, 62, 48, .26)",
        "textTone": "dark",
        "centering": (0.73, 0.53),
    },
    {
        "season": "summer",
        "master": "summer-cloud-harbor-master-v1.png",
        "staticId": 34,
        "animatedId": 35,
        "staticName": "云海游戏码头",
        "animatedName": "夏潮航行·动态",
        "overlay": "rgba(9, 55, 74, .30)",
        "textTone": "light",
        "centering": (0.72, 0.54),
    },
    {
        "season": "autumn",
        "master": "autumn-collector-walk-master-v1.png",
        "staticId": 36,
        "animatedId": 37,
        "staticName": "秋日收藏灯廊",
        "animatedName": "金叶轨道·动态",
        "overlay": "rgba(55, 34, 24, .30)",
        "textTone": "light",
        "centering": (0.72, 0.53),
    },
    {
        "season": "winter",
        "master": "winter-star-observatory-master-v1.png",
        "staticId": 38,
        "animatedId": 39,
        "staticName": "星雪信号台",
        "animatedName": "冬夜观测·动态",
        "overlay": "rgba(7, 13, 35, .34)",
        "textTone": "light",
        "centering": (0.72, 0.54),
    },
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rel_root(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def rel_assets(path: Path) -> str:
    return path.relative_to(ROOT / "public" / "assets").as_posix()


def fit(image: Image.Image, size: tuple[int, int], centering: tuple[float, float]) -> Image.Image:
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=centering)


def save_budget(image: Image.Image, path: Path, max_bytes: int, qualities: tuple[int, ...]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    for quality in qualities:
        image.save(path, "WEBP", quality=quality, method=6)
        if path.stat().st_size <= max_bytes:
            return
    raise RuntimeError(f"budget exceeded: {path} ({path.stat().st_size} bytes)")


def animation_frames(image: Image.Image, centering: tuple[float, float], count: int) -> list[Image.Image]:
    base = fit(image, (840, 472), centering)
    frames: list[Image.Image] = []
    for index in range(count):
        phase = index / max(1, count - 1)
        wave = 1.0 - abs(phase * 2.0 - 1.0)
        scale = 1.0 + 0.016 * wave
        width = round(720 / scale)
        height = round(405 / scale)
        x_center = base.width * (0.48 + 0.035 * (phase - 0.5))
        y_center = base.height * (0.50 - 0.018 * wave)
        left = max(0, min(base.width - width, round(x_center - width / 2)))
        top = max(0, min(base.height - height, round(y_center - height / 2)))
        frame = base.crop((left, top, left + width, top + height)).resize((720, 405), Image.Resampling.LANCZOS)
        frames.append(frame)
    return frames


def save_animation(image: Image.Image, centering: tuple[float, float], path: Path) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    for count in (12, 10, 8):
        frames = animation_frames(image, centering, count)
        for quality in (48, 42, 36, 30):
            frames[0].save(
                path,
                "WEBP",
                save_all=True,
                append_images=frames[1:],
                duration=240,
                loop=0,
                quality=quality,
                method=6,
                minimize_size=True,
            )
            if path.stat().st_size <= 1536 * 1024:
                return {"frames": count, "quality": quality, "durationMs": count * 240}
    raise RuntimeError(f"animation budget exceeded: {path} ({path.stat().st_size} bytes)")


def item(config: dict, paths: dict[str, Path], animated: bool, animation: dict | None) -> dict:
    asset_id = config["animatedId"] if animated else config["staticId"]
    selected = paths["animated"] if animated else paths["desktop"]
    result = {
        "assetId": f"P-BG-{asset_id:02d}",
        "id": asset_id,
        "name": config["animatedName"] if animated else config["staticName"],
        "theme": "seasonal-" + config["season"],
        "season": config["season"],
        "collectionId": "seasonal_" + config["season"] + "_v1",
        "tier": "premium-animated" if animated else "premium-static",
        "price": 32 if animated else 24,
        "animated": animated,
        "seasonalPresentationOnly": True,
        "poster": rel_assets(paths["poster"]),
        "asset": rel_assets(selected),
        "desktop": rel_assets(paths["desktop"]),
        "mobileCrop": rel_assets(paths["mobile"]),
        "miniCrop": rel_assets(paths["mini"]),
        "textTone": config["textTone"],
        "overlay": config["overlay"],
        "fallback": rel_assets(paths["desktop"]),
        "staticFallback": rel_assets(paths["desktop"]),
        "license": "project-owned-ai-generated",
        "source": rel_root(MASTER_ROOT / config["master"]),
        "integrity": "sha256:" + sha256(selected),
        "featureFlag": FLAG,
    }
    if animation:
        result["animation"] = {
            "format": "animated-webp",
            **animation,
            "policy": "visible-profile-or-explicit-shop-preview",
        }
    return result


def build_season(config: dict) -> tuple[list[dict], dict, Image.Image]:
    source_path = MASTER_ROOT / config["master"]
    if not source_path.exists():
        raise FileNotFoundError(source_path)
    source = ImageEnhance.Color(Image.open(source_path).convert("RGB")).enhance(0.98)
    runtime = RUNTIME_ROOT / config["season"]
    runtime.mkdir(parents=True, exist_ok=True)
    paths = {
        "desktop": runtime / f"{config['season']}-desktop-v1.webp",
        "mobile": runtime / f"{config['season']}-mobile-v1.webp",
        "poster": runtime / f"{config['season']}-poster-v1.webp",
        "mini": runtime / f"{config['season']}-mini-v1.webp",
        "animated": runtime / f"{config['season']}-animated-v1.webp",
    }
    desktop = fit(source, (1920, 1080), config["centering"])
    desktop.save(paths["desktop"], "WEBP", quality=84, method=6)
    save_budget(fit(source, (900, 1200), config["centering"]), paths["mobile"], 460 * 1024, (80, 74, 68, 62, 56))
    save_budget(fit(source, (640, 360), config["centering"]), paths["poster"], 180 * 1024, (78, 72, 66, 60, 54))
    save_budget(fit(source, (640, 360), config["centering"]), paths["mini"], 220 * 1024, (82, 76, 70, 64, 58))
    animation = save_animation(source, config["centering"], paths["animated"])
    variants = {
        key: {
            "path": rel_root(path),
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
            "width": {"desktop": 1920, "mobile": 900, "poster": 640, "mini": 640, "animated": 720}[key],
            "height": {"desktop": 1080, "mobile": 1200, "poster": 360, "mini": 360, "animated": 405}[key],
            "animated": key == "animated",
        }
        for key, path in paths.items()
    }
    source_record = {
        "season": config["season"],
        "path": rel_root(source_path),
        "sha256": sha256(source_path),
        "bytes": source_path.stat().st_size,
        "width": source.width,
        "height": source.height,
        "mode": "RGB",
    }
    return [item(config, paths, False, None), item(config, paths, True, animation)], {"source": source_record, "variants": variants}, fit(source, (640, 360), config["centering"])


def review_board(images: list[tuple[str, Image.Image]]) -> Path:
    board = Image.new("RGB", (1320, 820), "#fff8eb")
    draw = ImageDraw.Draw(board)
    font = ImageFont.load_default()
    for index, (label, image) in enumerate(images):
        x = 20 + (index % 2) * 650
        y = 20 + (index // 2) * 400
        board.paste(image, (x, y))
        draw.rounded_rectangle((x, y + 364, x + 640, y + 388), radius=9, fill="#2b2330")
        draw.text((x + 12, y + 370), label.upper(), fill="#fff8eb", font=font)
    path = SOURCE_ROOT / "review" / "seasonal-backgrounds-contact-sheet-v1.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    board.save(path, "PNG", optimize=True)
    return path


def update_global_manifest(variants: dict[str, str], hashes: dict[str, str], byte_map: dict[str, int], total: int, review: Path) -> None:
    manifest = json.loads(GLOBAL_MANIFEST.read_text(encoding="utf-8"))
    manifest["assets"] = [entry for entry in manifest.get("assets", []) if entry.get("asset_id") != FAMILY_ID]
    manifest["assets"].append(
        {
            "asset_id": FAMILY_ID,
            "runtime_id": "platform",
            "artwork_version": 1,
            "runtime_path": variants["spring-desktop"],
            "variants": variants,
            "status": "ready",
            "clearance": "OWNER_AUTHORIZED_ART_CLEARANCE",
            "source_asset_id": SOURCE_ASSET_ID,
            "feature_flags": {"operator": "all", "enabled_value": "1", "default_enabled": True, "ids": [FLAG]},
            "fallback_asset_id": "P-BACKGROUND-V1-CATALOG",
            "fallback": "same-season desktop -> existing Premium Background -> CSS theme surface",
            "load": "shop poster lazy; animated only for explicit preview or visible Profile; reduced-motion uses desktop static",
            "a11y": "decorative no-text backgrounds; identity, prices, states and actions remain live HTML/i18n",
            "license": "project-owned-ai-generated",
            "source": rel_root(MASTER_ROOT),
            "clearance_record": rel_root(SOURCE_ROOT / "OWNER_AUTHORIZED_ART_CLEARANCE.md"),
            "variant_integrity": {key: "sha256:" + value for key, value in hashes.items()},
            "variant_bytes": byte_map,
            "actual_bytes": total,
            "byte_budget": 10 * 1024 * 1024,
            "review_boards": [rel_root(review)],
        }
    )
    GLOBAL_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_asset_library(records: list[dict], review: Path) -> None:
    catalog = json.loads(ASSET_LIBRARY.read_text(encoding="utf-8"))
    collection_id = "seasonal-backgrounds-v1"
    catalog["collections"] = [entry for entry in catalog.get("collections", []) if entry.get("id") != collection_id]
    catalog["collections"].append(
        {
            "id": collection_id,
            "category": "platform/background",
            "catalogPath": rel_root(FAMILY_CATALOG),
            "catalogSha256": sha256(FAMILY_CATALOG),
            "licensePath": None,
            "licenseSha256": None,
            "masterRoot": rel_root(SOURCE_ROOT),
            "previewPath": rel_root(review),
            "sourceType": "generated",
            "license": "project-owned-ai-generated",
            "status": "integrated-local-only",
            "remoteObjectKey": None,
        }
    )
    for index in catalog.get("indexes", []):
        if index.get("id") == "production-asset-manifest":
            index["sha256"] = sha256(GLOBAL_MANIFEST)
    source_ids = {FAMILY_ID, *(f"ART-SEASONAL-BACKGROUND-{record['source']['season'].upper()}-V1" for record in records)}
    catalog["assets"] = [entry for entry in catalog.get("assets", []) if entry.get("id") not in source_ids]
    primary = records[0]["source"]
    all_runtime_paths = [variant["path"] for record in records for variant in record["variants"].values()]
    catalog["assets"].append(
        {
            "id": FAMILY_ID,
            "category": "platform/background/seasonal",
            "assetType": "seasonal-premium-background-family",
            "sourceType": "generated",
            "sourcePath": primary["path"],
            "sourceSha256": primary["sha256"],
            "license": "project-owned-ai-generated",
            "author": "OpenAI Codex built-in ImageGen for Ghost Game",
            "status": "integrated-local-only",
            "dimensions": {"width": primary["width"], "height": primary["height"]},
            "previewPath": primary["path"],
            "previewSha256": primary["sha256"],
            "runtimePaths": all_runtime_paths,
            "promptPath": rel_root(SOURCE_ROOT / "PROMPT_AND_PROVENANCE.md"),
            "model": "highest-quality-built-in-imagegen-runtime-managed",
            "remoteObjectKey": None,
        }
    )
    for record in records:
        source = record["source"]
        catalog["assets"].append(
            {
                "id": f"ART-SEASONAL-BACKGROUND-{source['season'].upper()}-V1",
                "category": "platform/background/seasonal",
                "assetType": "seasonal-premium-background-source-master",
                "sourceType": "generated",
                "sourcePath": source["path"],
                "sourceSha256": source["sha256"],
                "license": "project-owned-ai-generated",
                "author": "OpenAI Codex built-in ImageGen for Ghost Game",
                # Source masters remain outside the runtime Manifest; only their
                # owner-cleared WebP derivatives are integrated through the family.
                "status": "reference-only",
                "dimensions": {"width": source["width"], "height": source["height"]},
                "previewPath": source["path"],
                "previewSha256": source["sha256"],
                "runtimePaths": [source["path"]],
                "promptPath": rel_root(SOURCE_ROOT / "PROMPT_AND_PROVENANCE.md"),
                "model": "highest-quality-built-in-imagegen-runtime-managed",
                "remoteObjectKey": None,
            }
        )
    catalog["updatedAt"] = "2026-08-22T00:00:00+09:00"
    ASSET_LIBRARY.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    catalog_items: list[dict] = []
    records: list[dict] = []
    reviews: list[tuple[str, Image.Image]] = []
    manifest_variants: dict[str, str] = {}
    manifest_hashes: dict[str, str] = {}
    manifest_bytes: dict[str, int] = {}
    for config in SEASONS:
        items, record, preview = build_season(config)
        catalog_items.extend(items)
        records.append(record)
        reviews.append((config["season"], preview))
        for key, variant in record["variants"].items():
            manifest_key = f"{config['season']}-{key}"
            manifest_variants[manifest_key] = variant["path"]
            manifest_hashes[manifest_key] = variant["sha256"]
            manifest_bytes[manifest_key] = variant["bytes"]
    review = review_board(reviews)
    total = sum(manifest_bytes.values())
    family = {
        "schemaVersion": 1,
        "productionUnitId": "P2-01",
        "familyId": FAMILY_ID,
        "sourceAssetId": SOURCE_ASSET_ID,
        "artworkVersion": 1,
        "status": "OWNER_AUTHORIZED_ART_CLEARANCE",
        "license": "project-owned-ai-generated",
        "sourceGeneration": "OpenAI Codex built-in ImageGen with project-owned North Star references",
        "externalReferenceTransmissionCount": 0,
        "seasons": [config["season"] for config in SEASONS],
        "sourceMasters": [record["source"] for record in records],
        "runtimeVariants": manifest_variants,
        "variantIntegrity": manifest_hashes,
        "variantBytes": manifest_bytes,
        "reviewBoards": [rel_root(review)],
        "featureFlags": {"operator": "all", "enabledValue": "1", "defaultEnabled": True, "ids": [FLAG]},
        "metrics": {"sourceMasterCount": 4, "runtimeVariantCount": len(manifest_variants), "runtimeBytes": total, "runtimeByteBudget": 10 * 1024 * 1024, "withinBudget": total <= 10 * 1024 * 1024},
        "fallback": {"chain": "seasonal animated -> same-season desktop -> prior Premium Background -> CSS theme surface"},
        "authority": "presentation only; no Battle Pass, Remote Config, season clock, reward, social ranking, protocol, or persistence capability",
    }
    SOURCE_ROOT.mkdir(parents=True, exist_ok=True)
    (SOURCE_ROOT / "asset-family-manifest-v1.json").write_text(json.dumps(family, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    FAMILY_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    FAMILY_CATALOG.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "pack": "seasonal-background-pack-v1",
                "masterSize": "1536x1024 generated source; 1920x1080 desktop derivative",
                "featureFlag": FLAG,
                "runtimePolicy": {
                    "shopGrid": "poster-only",
                    "shopHover": "animated-on-explicit-preview",
                    "profile": "single-visible-animation",
                    "reducedMotion": "staticFallback",
                    "pageHidden": "detach-animation",
                },
                "budgets": {"posterBytes": 180 * 1024, "animatedBytes": 1536 * 1024, "familyBytes": 10 * 1024 * 1024},
                "items": catalog_items,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    update_global_manifest(manifest_variants, manifest_hashes, manifest_bytes, total, review)
    update_asset_library(records, review)
    print(json.dumps({"familyId": FAMILY_ID, "sourceMasters": 4, "catalogItems": len(catalog_items), "runtimeVariants": len(manifest_variants), "runtimeBytes": total, "review": rel_root(review)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
