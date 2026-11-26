"""One-shot master food catalogue image populator from open-source food datasets.

Sources (all public, no API keys required):
  1. TheMealDB (themealdb.com) - ~300 named dishes with high-res photos
  2. Hugging Face `rajistics/indian_food_images` - 20 Indian/fast-food classes
  3. Hugging Face `bharat-raghunathan/indian-foods-dataset` - 15 Indian food classes
  4. Hugging Face `ethz/food101` - 101 international food classes

For each matched class/dish, downloads up to N distinct real photos into
`backend/media/catalog/repo_<slug>_<idx>_{card,thumb}.webp` (800x600 & 300x300),
and assigns all 2,663 items in `master_food_catalog.json` by dish keyword match
(round-robin across variants in that class) with category fallback so 100% of
items have real food photos.
"""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from typing import Any

import requests
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
CATALOG_JSON = ROOT / "backend" / "apps" / "menu" / "data" / "master_food_catalog.json"
MEDIA_DIR = ROOT / "backend" / "media" / "catalog"
CARD_SIZE = (800, 600)
THUMB_SIZE = (300, 300)

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "ServeMyFoodCatalogBot/1.0"})

THEMEALDB_CATEGORIES = [
    "Beef",
    "Breakfast",
    "Chicken",
    "Dessert",
    "Goat",
    "Lamb",
    "Miscellaneous",
    "Pasta",
    "Pork",
    "Seafood",
    "Side",
    "Starter",
    "Vegan",
    "Vegetarian",
]

# Map catalogue dish keywords (checked in order, longest/most specific first) -> pool key
KEYWORD_TO_POOL: list[tuple[str, str]] = [
    ("masala dosa", "hf_masala_dosa"),
    ("dosa", "hf_dosa"),
    ("uthappam", "hf_dosa"),
    ("uttapam", "hf_dosa"),
    ("pesarattu", "hf_dosa"),
    ("adai", "hf_dosa"),
    ("idli", "hf_idli"),
    ("idiyappam", "hf_idli"),
    ("paniyaram", "hf_idli"),
    ("appam", "hf_dosa"),
    ("biryani", "hf_biryani"),
    ("biriyani", "hf_biryani"),
    ("pulao", "hf_biryani"),
    ("pulav", "hf_biryani"),
    ("fried rice", "hf_fried_rice"),
    ("schezwan rice", "hf_fried_rice"),
    ("butter naan", "hf_butter_naan"),
    ("garlic naan", "hf_butter_naan"),
    ("naan", "hf_naan"),
    ("kulcha", "hf_naan"),
    ("chapati", "hf_chapati"),
    ("roti", "hf_chapati"),
    ("phulka", "hf_chapati"),
    ("parotta", "hf_chapati"),
    ("paratha", "hf_chapati"),
    ("chole bhature", "hf_chole_bhature"),
    ("chana masala", "hf_chole_bhature"),
    ("dal makhani", "hf_dal_makhani"),
    ("dal", "hf_dal"),
    ("sambar", "hf_dal"),
    ("rasam", "hf_dal"),
    ("kadai paneer", "hf_kadai_paneer"),
    ("paneer", "hf_paneer"),
    ("kofta", "hf_kofta"),
    ("manchurian", "hf_kofta"),
    ("pav bhaji", "hf_pav_bhaji"),
    ("vada pav", "hf_vadapav"),
    ("dabeli", "hf_dabeli"),
    ("pani puri", "hf_paani_puri"),
    ("panipuri", "hf_paani_puri"),
    ("chaat", "hf_paani_puri"),
    ("bhel", "hf_paani_puri"),
    ("sev puri", "hf_paani_puri"),
    ("dahi puri", "hf_paani_puri"),
    ("samosa", "hf_samosa"),
    ("kachori", "hf_samosa"),
    ("pakora", "hf_pakora"),
    ("pakoda", "hf_pakode"),
    ("bhajji", "hf_pakode"),
    ("bajji", "hf_pakode"),
    ("bonda", "hf_pakode"),
    ("vada", "hf_pakode"),
    ("medu vada", "hf_pakode"),
    ("dhokla", "hf_dhokla"),
    ("kathi roll", "hf_kaathi_rolls"),
    ("frankie", "hf_kaathi_rolls"),
    ("shawarma", "hf_kaathi_rolls"),
    ("wrap", "hf_kaathi_rolls"),
    ("roll", "hf_spring_rolls"),
    ("spring roll", "hf_spring_rolls"),
    ("momo", "hf_momos"),
    ("dim sum", "hf_dumplings"),
    ("dumpling", "hf_dumplings"),
    ("jalebi", "hf_jalebi"),
    ("kulfi", "hf_kulfi"),
    ("ice cream", "hf_ice_cream"),
    ("falooda", "hf_ice_cream"),
    ("sundae", "hf_ice_cream"),
    ("milkshake", "hf_ice_cream"),
    ("shake", "hf_ice_cream"),
    ("chai", "hf_chai"),
    ("tea", "hf_chai"),
    ("coffee", "hf_chai"),
    ("burger", "hf_burger"),
    ("pizza", "hf_pizza"),
    ("pasta", "hf_spaghetti_bolognese"),
    ("spaghetti", "hf_spaghetti_bolognese"),
    ("penne", "hf_spaghetti_bolognese"),
    ("macaroni", "hf_macaroni_and_cheese"),
    ("lasagna", "hf_lasagna"),
    ("noodle", "hf_ramen"),
    ("hakka", "hf_ramen"),
    ("chowmein", "hf_ramen"),
    ("ramen", "hf_ramen"),
    ("pad thai", "hf_pad_thai"),
    ("french fries", "hf_french_fries"),
    ("fries", "hf_french_fries"),
    ("onion ring", "hf_onion_rings"),
    ("garlic bread", "hf_garlic_bread"),
    ("sandwich", "hf_club_sandwich"),
    ("toast", "hf_club_sandwich"),
    ("salad", "hf_caesar_salad"),
    ("soup", "hf_hot_and_sour_soup"),
    ("cake", "hf_chocolate_cake"),
    ("pastry", "hf_chocolate_cake"),
    ("brownie", "hf_chocolate_cake"),
    ("cheesecake", "hf_cheesecake"),
    ("cupcake", "hf_cup_cakes"),
    ("muffin", "hf_cup_cakes"),
    ("donut", "hf_donuts"),
    ("doughnut", "hf_donuts"),
    ("waffle", "hf_waffles"),
    ("pancake", "hf_pancakes"),
    ("omelette", "hf_omelette"),
    ("egg", "hf_omelette"),
    ("chicken wings", "hf_chicken_wings"),
    ("lollipop", "hf_chicken_wings"),
    ("tandoori", "hf_chicken_wings"),
    ("tikka", "hf_chicken_wings"),
    ("kebab", "hf_chicken_wings"),
    ("fish", "hf_fish_and_chips"),
    ("prawn", "hf_shrimp_and_grits"),
    ("shrimp", "hf_shrimp_and_grits"),
    ("crab", "hf_crab_cakes"),
    ("salmon", "hf_grilled_salmon"),
    ("steak", "hf_steak"),
    ("tiramisu", "hf_tiramisu"),
]

# Category fallback pool keys if no dish keyword matches
CATEGORY_TO_POOL: dict[str, str] = {
    "south_indian_tiffin": "hf_masala_dosa",
    "tea_coffee_snacks": "hf_chai",
    "biryani_rice": "hf_biryani",
    "indian_veg_curry": "hf_paneer",
    "indian_nonveg_curry": "mealdb_Chicken",
    "tandoori_grill": "hf_chicken_wings",
    "chinese_noodles_rice": "hf_fried_rice",
    "pizza_pasta": "hf_pizza",
    "fast_food_burgers": "hf_burger",
    "street_food_chaat": "hf_paani_puri",
    "seafood_specials": "mealdb_Seafood",
    "soups_salads": "hf_hot_and_sour_soup",
    "bakery_pastries": "hf_chocolate_cake",
    "ice_cream_desserts": "hf_ice_cream",
    "indian_sweets": "hf_jalebi",
    "juices_milkshakes": "hf_ice_cream",
}

FOOD101_KEEP = {
    "pizza",
    "hamburger",
    "fried_rice",
    "ice_cream",
    "french_fries",
    "spring_rolls",
    "dumplings",
    "garlic_bread",
    "club_sandwich",
    "caesar_salad",
    "cheesecake",
    "chocolate_cake",
    "cup_cakes",
    "donuts",
    "waffles",
    "pancakes",
    "omelette",
    "grilled_salmon",
    "fish_and_chips",
    "onion_rings",
    "hot_and_sour_soup",
    "ramen",
    "pad_thai",
    "spaghetti_bolognese",
    "lasagna",
    "macaroni_and_cheese",
    "chicken_wings",
    "crab_cakes",
    "shrimp_and_grits",
    "steak",
    "tiramisu",
    "samosa",
}


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def save_webp_pair(raw_bytes: bytes, base_name: str) -> tuple[str, str]:
    with Image.open(BytesIO(raw_bytes)) as img:
        rgb = img.convert("RGB")
        card = ImageOps.fit(rgb, CARD_SIZE, method=Image.Resampling.LANCZOS)
        thumb = ImageOps.fit(rgb, THUMB_SIZE, method=Image.Resampling.LANCZOS)

        card_name = f"{base_name}_card.webp"
        thumb_name = f"{base_name}_thumb.webp"
        card.save(MEDIA_DIR / card_name, "WEBP", quality=84, method=6)
        thumb.save(MEDIA_DIR / thumb_name, "WEBP", quality=80, method=6)
    return f"/media/catalog/{card_name}", f"/media/catalog/{thumb_name}"


def fetch_hf_dataset_urls(
    dataset: str,
    prefix: str,
    per_class_limit: int = 12,
    keep_classes: set[str] | None = None,
    max_pages: int = 12,
) -> dict[str, list[str]]:
    """Collect image URLs per class from Hugging Face Datasets Server."""
    info = SESSION.get(
        f"https://datasets-server.huggingface.co/info?dataset={dataset}",
        timeout=20,
    ).json()
    label_names: list[str] = (
        info.get("dataset_info", {})
        .get("default", {})
        .get("features", {})
        .get("label", {})
        .get("names", [])
    )
    if not label_names:
        return {}

    pools: dict[str, list[str]] = {}
    target_classes = keep_classes or set(label_names)

    def need_more() -> bool:
        return any(len(pools.get(f"{prefix}_{c}", [])) < per_class_limit for c in target_classes)

    # Sample evenly across the dataset so we hit all classes quickly
    total_rows = (
        info.get("dataset_info", {})
        .get("default", {})
        .get("splits", {})
        .get("train", {})
        .get("num_examples", 2000)
    )
    step = max(100, total_rows // max_pages)

    for offset in range(0, min(total_rows, step * max_pages), step):
        if not need_more():
            break
        try:
            resp = SESSION.get(
                "https://datasets-server.huggingface.co/rows",
                params={
                    "dataset": dataset,
                    "config": "default",
                    "split": "train",
                    "offset": offset,
                    "length": 100,
                },
                timeout=20,
            )
            if resp.status_code != 200:
                continue
            rows = resp.json().get("rows", [])
            for item in rows:
                row = item.get("row", {})
                lbl_idx = row.get("label")
                if not isinstance(lbl_idx, int) or lbl_idx >= len(label_names):
                    continue
                cls_name = label_names[lbl_idx]
                if keep_classes and cls_name not in keep_classes:
                    continue
                img_src = row.get("image", {}).get("src")
                if not img_src:
                    continue
                pool_key = f"{prefix}_{'burger' if cls_name == 'hamburger' else cls_name}"
                bucket = pools.setdefault(pool_key, [])
                if len(bucket) < per_class_limit and img_src not in bucket:
                    bucket.append(img_src)
        except Exception:
            continue

    return pools


def fetch_themealdb_urls() -> tuple[dict[str, str], dict[str, list[str]]]:
    """Return (dish_name -> url, category_pool -> [urls])."""
    by_name: dict[str, str] = {}
    by_cat: dict[str, list[str]] = {}
    for cat in THEMEALDB_CATEGORIES:
        try:
            r = SESSION.get(
                f"https://www.themealdb.com/api/json/v1/1/filter.php?c={cat}",
                timeout=15,
            ).json()
            meals = r.get("meals") or []
            for m in meals:
                name = (m.get("strMeal") or "").strip()
                thumb = (m.get("strMealThumb") or "").strip()
                if name and thumb:
                    by_name[name.lower()] = thumb
                    by_cat.setdefault(f"mealdb_{cat}", []).append(thumb)
        except Exception:
            continue
    return by_name, by_cat


def download_one(task: tuple[str, str, str]) -> tuple[str, str, tuple[str, str] | None]:
    pool_key, base_name, url = task
    try:
        r = SESSION.get(url, timeout=20)
        if r.status_code != 200 or len(r.content) < 2000:
            return pool_key, base_name, None
        pair = save_webp_pair(r.content, base_name)
        return pool_key, base_name, pair
    except Exception:
        return pool_key, base_name, None


def main() -> None:
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    items: list[dict[str, Any]] = json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
    print(f"Loaded {len(items)} catalogue items.")

    print("1/4 Collecting Hugging Face rajistics/indian_food_images...")
    pools: dict[str, list[str]] = {}
    pools.update(fetch_hf_dataset_urls("rajistics/indian_food_images", "hf", per_class_limit=12, max_pages=18))

    print("2/4 Collecting Hugging Face bharat-raghunathan/indian-foods-dataset...")
    bharat_pools = fetch_hf_dataset_urls(
        "bharat-raghunathan/indian-foods-dataset", "hf", per_class_limit=12, max_pages=18
    )
    for k, urls in bharat_pools.items():
        pools.setdefault(k, []).extend(urls)

    print("3/4 Collecting Hugging Face ethz/food101 (selected classes)...")
    f101_pools = fetch_hf_dataset_urls(
        "ethz/food101", "hf", per_class_limit=8, keep_classes=FOOD101_KEEP, max_pages=30
    )
    for k, urls in f101_pools.items():
        pools.setdefault(k, []).extend(urls)

    print("4/4 Collecting TheMealDB dishes...")
    mealdb_by_name, mealdb_by_cat = fetch_themealdb_urls()
    for k, urls in mealdb_by_cat.items():
        pools[k] = urls[:15]

    # Build download tasks
    tasks: list[tuple[str, str, str]] = []
    for pool_key, urls in pools.items():
        for idx, url in enumerate(urls[:12], start=1):
            base_name = f"repo_{slugify(pool_key)}_{idx:02d}"
            tasks.append((pool_key, base_name, url))

    # Also match exact/substring TheMealDB dish names for catalogue items
    mealdb_exact_tasks: dict[str, tuple[str, str]] = {}
    for item in items:
        nm = item["name"].lower()
        for meal_name, url in mealdb_by_name.items():
            if meal_name == nm or (len(meal_name) >= 6 and meal_name in nm):
                base_name = f"repo_meal_{slugify(meal_name)}"
                if base_name not in mealdb_exact_tasks:
                    mealdb_exact_tasks[base_name] = (url, item["item_code"])
                break

    for base_name, (url, _) in mealdb_exact_tasks.items():
        tasks.append((f"exact_{base_name}", base_name, url))

    print(f"Downloading & converting {len(tasks)} real food photos to WebP...")
    local_pools: dict[str, list[tuple[str, str]]] = {}
    exact_local: dict[str, tuple[str, str]] = {}

    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = [ex.submit(download_one, t) for t in tasks]
        done = 0
        for fut in as_completed(futures):
            done += 1
            pool_key, base_name, pair = fut.result()
            if pair:
                if pool_key.startswith("exact_"):
                    exact_local[base_name] = pair
                else:
                    local_pools.setdefault(pool_key, []).append(pair)
            if done % 100 == 0:
                print(f"  Processed {done}/{len(tasks)} downloads...")

    # Fallback pool if any specific HF class had 0 downloads
    any_fallback = next(iter(local_pools.values()))
    counters: dict[str, int] = {}

    matched_keyword = 0
    matched_exact = 0
    matched_category = 0

    for item in items:
        nm_lower = item["name"].lower()
        assigned: tuple[str, str] | None = None

        # 1. Exact TheMealDB match
        for meal_name in mealdb_by_name:
            if meal_name == nm_lower or (len(meal_name) >= 6 and meal_name in nm_lower):
                bname = f"repo_meal_{slugify(meal_name)}"
                if bname in exact_local:
                    assigned = exact_local[bname]
                    matched_exact += 1
                    break

        # 2. Keyword match against HF food classes
        if not assigned:
            for kw, pool_key in KEYWORD_TO_POOL:
                if kw in nm_lower and local_pools.get(pool_key):
                    idx = counters.get(pool_key, 0)
                    variants = local_pools[pool_key]
                    assigned = variants[idx % len(variants)]
                    counters[pool_key] = idx + 1
                    matched_keyword += 1
                    break

        # 3. Category fallback from downloaded real food pools
        if not assigned:
            cat_pool = CATEGORY_TO_POOL.get(item.get("image_key", ""), "")
            variants = local_pools.get(cat_pool) or any_fallback
            idx = counters.get(cat_pool, 0)
            assigned = variants[idx % len(variants)]
            counters[cat_pool] = idx + 1
            matched_category += 1

        item["image_card"], item["image_thumb"] = assigned

    CATALOG_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    total_files = len(list(MEDIA_DIR.glob("*.webp")))
    print(
        f"Done! Assigned all {len(items)} items "
        f"(exact={matched_exact}, keyword={matched_keyword}, category={matched_category}). "
        f"Total WebP files in media/catalog: {total_files}."
    )


if __name__ == "__main__":
    main()
