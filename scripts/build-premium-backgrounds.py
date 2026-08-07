"""Build the Premium Background Pack v1 from six approved master images.

This is an authoring-time helper. Runtime remains zero-dependency.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "art-source" / "platform" / "backgrounds" / "v1"
RUNTIME_ROOT = ROOT / "public" / "assets" / "backgrounds" / "v1"
CATALOG_PATH = RUNTIME_ROOT / "background_catalog_v1.json"

THEMES = [
    {
        "theme": "pixel",
        "staticId": 20,
        "animatedId": 21,
        "staticName": "像素夜城",
        "animatedName": "像素星火·动态",
        "textTone": "light",
        "overlay": "rgba(5, 13, 34, .42)",
    },
    {
        "theme": "anime",
        "staticId": 22,
        "animatedId": 23,
        "staticName": "晴空回廊",
        "animatedName": "云海微光·动态",
        "textTone": "light",
        "overlay": "rgba(17, 34, 92, .30)",
    },
    {
        "theme": "landscape",
        "staticId": 24,
        "animatedId": 25,
        "staticName": "月海群峰",
        "animatedName": "潮汐月影·动态",
        "textTone": "light",
        "overlay": "rgba(3, 22, 43, .38)",
    },
    {
        "theme": "animal",
        "staticId": 26,
        "animatedId": 27,
        "staticName": "月下伙伴",
        "animatedName": "灯火呼吸·动态",
        "textTone": "light",
        "overlay": "rgba(8, 25, 44, .40)",
    },
    {
        "theme": "neon",
        "staticId": 28,
        "animatedId": 29,
        "staticName": "霓虹穹庭",
        "animatedName": "光轨脉冲·动态",
        "textTone": "light",
        "overlay": "rgba(4, 5, 25, .34)",
    },
    {
        "theme": "technology",
        "staticId": 30,
        "animatedId": 31,
        "staticName": "轨道船坞",
        "animatedName": "深空巡航·动态",
        "textTone": "light",
        "overlay": "rgba(2, 13, 27, .36)",
    },
]


def rel_public(path: Path) -> str:
    return path.relative_to(ROOT / "public" / "assets").as_posix()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def fit(image: Image.Image, size: tuple[int, int], centering=(0.5, 0.5)) -> Image.Image:
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=centering)


def save_webp_budget(image: Image.Image, path: Path, max_bytes: int, qualities: list[int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    for quality in qualities:
        image.save(path, "WEBP", quality=quality, method=6)
        if path.stat().st_size <= max_bytes:
            return
    raise RuntimeError(f"Unable to meet budget for {path}: {path.stat().st_size} bytes")


def animation_frames(image: Image.Image, count: int) -> list[Image.Image]:
    frames: list[Image.Image] = []
    canvas = fit(image, (800, 450))
    for index in range(count):
        # A restrained ping-pong Ken Burns motion; no flashing or hard cuts.
        phase = index / max(1, count - 1)
        wave = 1.0 - abs(phase * 2.0 - 1.0)
        scale = 1.0 + 0.018 * wave
        width = round(720 / scale)
        height = round(405 / scale)
        x = round((canvas.width - width) * (0.42 + 0.16 * phase))
        y = round((canvas.height - height) * (0.48 - 0.04 * wave))
        crop = canvas.crop((x, y, x + width, y + height)).resize((720, 405), Image.Resampling.LANCZOS)
        frames.append(crop)
    return frames


def save_animation_budget(image: Image.Image, path: Path, max_bytes: int) -> tuple[int, int]:
    path.parent.mkdir(parents=True, exist_ok=True)
    for frame_count in (12, 10, 8):
        frames = animation_frames(image, frame_count)
        for quality in (50, 42, 36, 30):
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
            if path.stat().st_size <= max_bytes:
                return frame_count, quality
    raise RuntimeError(f"Unable to meet animation budget for {path}: {path.stat().st_size} bytes")


def catalog_item(config: dict, *, animated: bool, paths: dict[str, Path], animation_meta=None) -> dict:
    item_id = config["animatedId"] if animated else config["staticId"]
    fallback = paths["desktop"]
    item = {
        "assetId": f"P-BG-{item_id:02d}",
        "id": item_id,
        "name": config["animatedName"] if animated else config["staticName"],
        "theme": config["theme"],
        "collectionId": config["theme"] + "_origins",
        "tier": "premium-animated" if animated else "premium-static",
        "price": 32 if animated else 24,
        "animated": animated,
        "poster": rel_public(paths["poster"]),
        "asset": rel_public(paths["animated"] if animated else paths["desktop"]),
        "desktop": rel_public(paths["desktop"]),
        "mobileCrop": rel_public(paths["mobile"]),
        "miniCrop": rel_public(paths["mini"]),
        "textTone": config["textTone"],
        "overlay": config["overlay"],
        "fallback": rel_public(fallback),
        "staticFallback": rel_public(fallback),
        "license": "project-owned-ai-generated",
        "source": f"art-source/platform/backgrounds/v1/{config['theme']}/master.png",
        "integrity": sha256(paths["animated"] if animated else paths["desktop"]),
    }
    if animation_meta:
        item["animation"] = {
            "format": "animated-webp",
            "frames": animation_meta[0],
            "quality": animation_meta[1],
            "durationMs": animation_meta[0] * 240,
            "policy": "visible-profile-or-explicit-shop-preview",
        }
    return item


def build_theme(config: dict) -> list[dict]:
    theme = config["theme"]
    master = SOURCE_ROOT / theme / "master.png"
    if not master.exists():
        raise FileNotFoundError(master)
    runtime = RUNTIME_ROOT / theme
    runtime.mkdir(parents=True, exist_ok=True)
    source = Image.open(master).convert("RGB")
    source = ImageEnhance.Color(source).enhance(0.98)
    desktop_image = fit(source, (1920, 1080))
    paths = {
        "desktop": runtime / f"{theme}_desktop.webp",
        "poster": runtime / f"{theme}_poster.webp",
        "mobile": runtime / f"{theme}_mobile.webp",
        "mini": runtime / f"{theme}_mini.webp",
        "animated": runtime / f"{theme}_animated.webp",
    }
    desktop_image.save(paths["desktop"], "WEBP", quality=84, method=6)
    save_webp_budget(fit(source, (640, 360)), paths["poster"], 180 * 1024, [78, 72, 66, 60, 54])
    save_webp_budget(fit(source, (900, 1200)), paths["mobile"], 420 * 1024, [80, 74, 68, 62, 56])
    save_webp_budget(fit(source, (640, 360)), paths["mini"], 220 * 1024, [82, 76, 70, 64, 58])
    animation_meta = save_animation_budget(source, paths["animated"], 1536 * 1024)
    return [
        catalog_item(config, animated=False, paths=paths),
        catalog_item(config, animated=True, paths=paths, animation_meta=animation_meta),
    ]


def main() -> None:
    items: list[dict] = []
    for config in THEMES:
        items.extend(build_theme(config))
    catalog = {
        "schemaVersion": 1,
        "pack": "premium-background-pack-v1",
        "masterSize": "1920x1080",
        "runtimePolicy": {
            "shopGrid": "poster-only",
            "shopHover": "animated-on-explicit-preview",
            "profile": "single-visible-animation",
            "reducedMotion": "staticFallback",
            "pageHidden": "detach-animation",
        },
        "budgets": {"posterBytes": 180 * 1024, "animatedBytes": 1536 * 1024},
        "items": items,
    }
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(items)} background items: {CATALOG_PATH}")
    for item in items:
        path = ROOT / "public" / "assets" / item["asset"]
        print(f"  {item['id']:>2} {item['theme']:<10} {item['tier']:<17} {path.stat().st_size:>8} bytes")


if __name__ == "__main__":
    main()
