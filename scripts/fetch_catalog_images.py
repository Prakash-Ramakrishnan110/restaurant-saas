"""Fetch open-license food photography from Wikipedia, Wikimedia Commons, and optional Pixabay API."""

from __future__ import annotations

import argparse
import concurrent.futures
import io
import json
import re
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
CATALOG_JSON = ROOT / "backend" / "apps" / "menu" / "data" / "master_food_catalog.json"
MEDIA_CATALOG = ROOT / "backend" / "media" / "catalog"
HEADERS = {"User-Agent": "ServeMyFoodCatalogBot/1.0 (https://servemyfood.in)"}
LOCK = threading.Lock()


def _http_get_json(url: str, timeout: int = 12) -> dict | list | None:
    for attempt in range(3):
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 503):
                time.sleep(1.5 * (attempt + 1))
                continue
            return None
        except Exception:
            return None
    return None


def _download_bytes(url: str, timeout: int = 15) -> bytes | None:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except Exception:
        return None


def _wiki_summary_image(title: str) -> str | None:
    encoded = urllib.parse.quote(title.replace(" ", "_"))
    data = _http_get_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}")
    if not isinstance(data, dict) or data.get("type") == "disambiguation":
        return None
    img = (data.get("originalimage") or data.get("thumbnail") or {}).get("source")
    if img and not any(bad in img.lower() for bad in (".svg", "flag_", "map_", "logo", "icon")):
        return img
    return None


def _wiki_opensearch_image(query: str) -> str | None:
    q = urllib.parse.quote(query)
    data = _http_get_json(
        f"https://en.wikipedia.org/w/api.php?action=opensearch&search={q}&limit=2&format=json"
    )
    if not isinstance(data, list) or len(data) < 2:
        return None
    for title in data[1]:
        img = _wiki_summary_image(str(title))
        if img:
            return img
    return None


def _commons_search_image(query: str) -> str | None:
    q = urllib.parse.quote(f"{query} filetype:bitmap")
    url = (
        "https://commons.wikimedia.org/w/api.php"
        f"?action=query&generator=search&gsrnamespace=6&gsrsearch={q}"
        "&gsrlimit=2&prop=imageinfo&iiprop=url|mime&iiurlwidth=900&format=json"
    )
    data = _http_get_json(url)
    if not isinstance(data, dict):
        return None
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]
        mime = (info.get("mime") or "").lower()
        if mime not in ("image/jpeg", "image/png", "image/webp"):
            continue
        return info.get("thumburl") or info.get("url")
    return None


def _pixabay_search_image(query: str, api_key: str) -> str | None:
    q = urllib.parse.quote(query)
    url = (
        f"https://pixabay.com/api/?key={urllib.parse.quote(api_key)}"
        f"&q={q}&image_type=photo&category=food&per_page=3&safesearch=true"
    )
    data = _http_get_json(url)
    if not isinstance(data, dict):
        return None
    hits = data.get("hits") or []
    if not hits:
        return None
    return hits[0].get("webformatURL") or hits[0].get("largeImageURL")


def _clean_search_name(name: str) -> str:
    cleaned = re.sub(
        r"\b(Tamil Style|Kerala Style|Karnataka Style|Andhra Style|Delhi Style|"
        r"Kongunadu|Chettinad|Madurai|Dindigul|Karaikudi|Ambur|Tirunelveli|"
        r"Special|Combo|Pack|Set|Full|Half|Quarter|Plate|Mini|Regular|Classic|Double)\b",
        "",
        name,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s+", " ", cleaned).strip()


def process_item(args: tuple[dict, str | None]) -> tuple[str, bool]:
    item, pixabay_key = args
    code = str(item["item_code"])
    card_path = MEDIA_CATALOG / f"{code}_card.webp"
    thumb_path = MEDIA_CATALOG / f"{code}_thumb.webp"

    if card_path.exists() and thumb_path.exists():
        item["image_card"] = f"/media/catalog/{code}_card.webp"
        item["image_thumb"] = f"/media/catalog/{code}_thumb.webp"
        return code, True

    name = str(item["name"])
    clean_name = _clean_search_name(name)
    time.sleep(0.15)

    img_url = None
    if pixabay_key:
        img_url = _pixabay_search_image(clean_name or name, pixabay_key)
    if not img_url:
        img_url = _wiki_summary_image(name)
    if not img_url and clean_name and clean_name != name:
        img_url = _wiki_summary_image(clean_name)
    if not img_url:
        img_url = _wiki_opensearch_image(clean_name or name)
    if not img_url:
        img_url = _commons_search_image(clean_name or name)

    if not img_url:
        return code, False

    raw = _download_bytes(img_url)
    if not raw:
        return code, False

    try:
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        if im.width < 200 or im.height < 150:
            return code, False
        card = ImageOps.fit(im, (800, 600), method=Image.Resampling.LANCZOS)
        thumb = ImageOps.fit(im, (300, 300), method=Image.Resampling.LANCZOS)
        card.save(card_path, "WEBP", quality=82)
        thumb.save(thumb_path, "WEBP", quality=80)
        with LOCK:
            item["image_card"] = f"/media/catalog/{code}_card.webp"
            item["image_thumb"] = f"/media/catalog/{code}_thumb.webp"
        return code, True
    except Exception:
        return code, False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pixabay-key", type=str, default="", help="Optional free Pixabay API key")
    parser.add_argument("--limit", type=int, default=0, help="Optional max items to process")
    args = parser.parse_args()

    MEDIA_CATALOG.mkdir(parents=True, exist_ok=True)
    catalog = json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
    target = catalog[: args.limit] if args.limit > 0 else catalog
    total = len(target)
    matched = 0
    pixabay_key = args.pixabay_key.strip() or None

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for i, (_code, ok) in enumerate(
            pool.map(process_item, [(it, pixabay_key) for it in target]), start=1
        ):
            if ok:
                matched += 1
            if i % 100 == 0 or i == total:
                print(f"Progress: {i}/{total} checked, {matched} unique dish photos matched")
                CATALOG_JSON.write_text(
                    json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8"
                )

    print(f"Done: {matched}/{total} items now have unique dish photos.")


if __name__ == "__main__":
    main()
