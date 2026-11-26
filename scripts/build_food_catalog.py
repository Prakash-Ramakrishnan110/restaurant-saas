"""Clean and expand the uploaded Fusion Engine Food Catalogue into JSON + clean XLSX."""

from __future__ import annotations

import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SOURCE_XLSX = Path(
    r"C:\Users\praka\.gemini\antigravity\brain\3936ab40-d893-4554-9d59-cf1863965627"
    r"\.user_uploaded\media_1795617901335_3346d3ab.xlsx"
)
OUT_JSON = ROOT / "backend" / "apps" / "menu" / "data" / "master_food_catalog.json"
OUT_XLSX = ROOT / "docs" / "product" / "Fusion_Engine_Food_Catalogue_Clean.xlsx"

NON_VEG_KEYWORDS = (
    "chicken",
    "mutton",
    "fish",
    "prawn",
    "shrimp",
    "crab",
    "squid",
    "lobster",
    "beef",
    "lamb",
    "pork",
    "duck",
    "turkey",
    "salmon",
    "tuna",
    "seafood",
    "keema",
    "kari ",
    "nattu kozhi",
    "natukodi",
    "kodi ",
    "aatu",
    "aadu",
    "meen",
    "nandu",
    "kanava",
    "sura",
    "vanjaram",
    "nethili",
    "viral meen",
    "sankara",
    "kezhanga",
    "koduva",
    "mathi",
    "ayirai",
    "parai meen",
    "ilish",
    "machha",
    "macher",
    "chingri",
    "kosha mangsho",
    "laal maas",
    "safed maas",
    "champaran meat",
    "pepperoni",
    "sausage",
    "ham ",
    "pandi",
    "kori ",
    "royyala",
    "shawaya",
    "alfaham",
    "faham",
    "madhbi",
    "mandi",
    "kabsa",
    "ouzi",
    "shish tawook",
    "galouti",
    "kakori",
    "nihari",
    "paya",
    "haleem",
    "bone marrow",
    "liver",
    "kidney",
    "brain",
    "kudal",
    "boti",
    "thalakari",
    "unagi",
    "ebi ",
    "ika ",
    "bulgogi",
    "gyudon",
    "oyakodon",
    "katsudon",
    "tonkatsu",
    "char siu",
    "calamari",
    "karuvadu",
    "macchi",
    "sardine",
    "clam ",
    "prawn",
    "non-veg",
)

EGG_KEYWORDS = (
    "egg",
    "omelette",
    "kalakki",
    "half boil",
    "full boil",
    "shakshuka",
    "frittata",
    "tamagoyaki",
    "century egg",
    "muttai",
)

VEG_OVERRIDE_KEYWORDS = (
    "eggless",
    "vegan",
    "vegetarian",
    "veg ",
    "mock ",
    "soya ",
    "paneer",
    "mushroom",
    "baby corn",
    "gobi",
    "aloo",
    "tofu",
    "khaman dhokla",
    "miso glazed eggplant",
    "chickpea omelette",
)

TAMIL_NAMES: dict[str, str] = {
    "Idli": "இட்லி",
    "Mini Idli": "மினி இட்லி",
    "Sambar Idli": "சாம்பார் இட்லி",
    "Ghee Podi Idli": "நெய் பொடி இட்லி",
    "Medu Vada": "மெது வடை",
    "Masala Vada": "மசாலா வடை",
    "Plain Dosa": "சாதா தோசை",
    "Ghee Dosa": "நெய் தோசை",
    "Masala Dosa": "மசாலா தோசை",
    "Onion Dosa": "வெங்காய தோசை",
    "Podi Dosa": "பொடி தோசை",
    "Rava Dosa": "ரவா தோசை",
    "Set Dosa": "செட் தோசை",
    "Kal Dosa": "கல் தோசை",
    "Egg Dosa": "முட்டை தோசை",
    "Uthappam": "ஊத்தப்பம்",
    "Onion Uthappam": "வெங்காய ஊத்தப்பம்",
    "Ven Pongal": "வெண் பொங்கல்",
    "Poori Masala": "பூரி மசாலா",
    "Appam": "ஆப்பம்",
    "Idiyappam": "இடியாப்பம்",
    "Parotta": "பரோட்டா",
    "Kothu Parotta": "கொத்து பரோட்டா",
    "Chicken Kothu Parotta": "சிக்கன் கொத்து பரோட்டா",
    "Egg Kothu Parotta": "முட்டை கொத்து பரோட்டா",
    "Chapati": "சப்பாத்தி",
    "Butter Naan": "பட்டர் நான்",
    "Curd Rice": "தயிர் சாதம்",
    "Lemon Rice": "எலுமிச்சை சாதம்",
    "Tomato Rice": "தக்காளி சாதம்",
    "Sambar Rice": "சாம்பார் சாதம்",
    "Chicken Biryani": "சிக்கன் பிரியாணி",
    "Mutton Biryani": "மட்டன் பிரியாணி",
    "Egg Biryani": "முட்டை பிரியாணி",
    "Veg Biryani": "வெஜ் பிரியாணி",
    "Filter Coffee": "பில்டர் காபி",
    "Regular Tea": "டீ",
    "Ginger Tea": "இஞ்சி டீ",
    "Masala Tea": "மசாலா டீ",
    "Lemon Tea": "லெமன் டீ",
    "Rose Milk": "ரோஸ் மில்க்",
    "Badam Milk": "பாதாம் பால்",
    "Jigarthanda": "ஜிகர்தண்டா",
    "Samosa": "சமோசா",
    "Onion Bajji": "வெங்காய பஜ்ஜி",
    "Mirchi Bajji": "மிளகாய் பஜ்ஜி",
    "Veg Puff": "வெஜ் பப்ஸ்",
    "Egg Puff": "முட்டை பப்ஸ்",
    "Chicken Puff": "சிக்கன் பப்ஸ்",
    "Gulab Jamun": "குலாப் ஜாமுன்",
    "Mysore Pak": "மைசூர் பாக்",
    "Kesari": "கேசரி",
    "Chicken 65": "சிக்கன் 65",
    "Chicken Lollipop": "சிக்கன் லாலிபாப்",
    "Tandoori Chicken": "தந்தூரி சிக்கன்",
    "Butter Chicken": "பட்டர் சிக்கன்",
    "Paneer Butter Masala": "பன்னீர் பட்டர் மசாலா",
    "Chicken Fried Rice": "சிக்கன் ஃப்ரைடு ரைஸ்",
    "Veg Fried Rice": "வெஜ் ஃப்ரைடு ரைஸ்",
    "Egg Fried Rice": "முட்டை ஃப்ரைடு ரைஸ்",
}

EXTRA_ITEMS: list[tuple[str, str, str, str, str, str, int]] = [
    # (Name, Main Category, Subcategory, Cuisine, FoodType, Description, DefaultPriceINR)
    ("Parotta", "South Indian Tiffin & Dosa Variations", "Parotta & Chapati Varieties", "Tamil Nadu", "VEG", "Flaky layered South Indian flatbread served hot with salna or kurma.", 25),
    ("Chapati", "South Indian Tiffin & Dosa Variations", "Parotta & Chapati Varieties", "Indian", "VEG", "Soft whole-wheat flatbread cooked on a hot tawa, served with kurma or curry.", 20),
    ("Butter Naan", "Indian Main Course", "Indian Breads", "North Indian", "VEG", "Soft tandoor-baked leavened flatbread brushed with melted butter.", 55),
    ("Garlic Naan", "Indian Main Course", "Indian Breads", "North Indian", "VEG", "Tandoor-baked naan topped with minced garlic and fresh coriander.", 65),
    ("Tandoori Roti", "Indian Main Course", "Indian Breads", "North Indian", "VEG", "Crisp whole-wheat flatbread baked inside a clay tandoor.", 30),
    ("Ghee Podi Idli", "Breakfast", "South Indian Vegetarian", "Tamil Nadu", "VEG", "Steamed idlis tossed in aromatic roasted lentil podi and pure ghee.", 75),
    ("Rava Kesari", "Sweets Desserts & Ice Cream", "Indian Sweets", "South Indian", "VEG", "Warm saffron-infused semolina dessert cooked with ghee, cashews, and raisins.", 50),
    ("Vada Curry", "South Indian Meals & Regional", "Regional Gravies & Accompaniments", "Tamil Nadu", "VEG", "Spiced crumbled lentil vada simmered in a rich tomato and coconut gravy.", 60),
    ("Idiyappam with Coconut Milk", "Breakfast", "South Indian Vegetarian", "Tamil Nadu", "VEG", "Steamed rice string hoppers served with lightly sweetened fresh coconut milk.", 70),
    ("Appam with Coconut Milk", "Breakfast", "South Indian Vegetarian", "South Indian", "VEG", "Lacy fermented rice hoppers with soft centres served with fresh coconut milk.", 75),
    ("Egg Kothu Chapati", "South Indian Tiffin & Dosa Variations", "Parotta & Chapati Varieties", "Tamil Nadu", "EGG", "Shredded chapati stir-fried on a griddle with egg, onions, spices, and salna.", 110),
    ("Mutton Sukka Biryani", "Biryani & Rice", "Non-Vegetarian Biryani", "Tamil Nadu", "NON_VEG", "Fragrant seeraga samba biryani topped with spicy roasted mutton sukka.", 290),
    ("Prawn 65 Biryani", "Biryani & Rice", "Non-Vegetarian Biryani", "South Indian", "NON_VEG", "Spiced dum biryani served with crispy fried prawn 65.", 280),
    ("Gobi 65 Biryani", "Biryani & Rice", "Vegetarian Biryani & Rice", "South Indian", "VEG", "Aromatic vegetable biryani paired with crispy spiced cauliflower 65.", 180),
    ("Paneer 65 Biryani", "Biryani & Rice", "Vegetarian Biryani & Rice", "South Indian", "VEG", "Flavourful dum biryani topped with crispy golden paneer 65.", 210),
    ("Schezwan Chicken Fried Rice", "Chinese & Asian", "Non-Vegetarian Chinese", "Indo-Chinese", "NON_VEG", "Wok-tossed basmati rice with tender chicken, vegetables, and fiery Schezwan sauce.", 180),
    ("Chicken Lollipop Gravy", "Chinese & Asian", "Non-Vegetarian Chinese", "Indo-Chinese", "NON_VEG", "Crispy fried chicken drumettes tossed in a tangy garlic-chilli sauce.", 220),
    ("Filter Coffee Parcel", "Tea Shop & Chai Kadai", "Coffee & Milk Drinks", "Tamil Nadu", "VEG", "Hot traditional South Indian filter coffee packed fresh in a thermal pouch.", 40),
    ("Masala Tea Flask", "Tea Shop & Chai Kadai", "Tea", "Indian", "VEG", "Sharing flask of freshly brewed spiced masala chai for 4–5 cups.", 120),
    ("Kuzhi Paniyaram Sweet", "Breakfast", "South Indian Vegetarian", "Tamil Nadu", "VEG", "Golden pan-roasted rice and jaggery dumplings flavoured with cardamom.", 60),
    ("Kuzhi Paniyaram Kara", "Breakfast", "South Indian Vegetarian", "Tamil Nadu", "VEG", "Savory pan-roasted lentil-rice dumplings tempered with onions, mustard, and curry leaves.", 60),
    ("Palkova Cup", "Sweets Desserts & Ice Cream", "Indian Sweets", "Tamil Nadu", "VEG", "Slow-reduced Srivilliputtur-style milk fudge served fresh in a cup.", 45),
    ("Chilli Parotta Gravy", "South Indian Tiffin & Dosa Variations", "Parotta & Chapati Varieties", "Tamil Nadu", "VEG", "Crispy fried parotta strips tossed with capsicum, onions, and spicy sauce.", 130),
    ("Wheat Chapati Set", "South Indian Tiffin & Dosa Variations", "Parotta & Chapati Varieties", "Indian", "VEG", "Two soft whole-wheat chapatis served with vegetable kurma.", 65),
    ("Bun Butter Jam Toast", "Tea Shop & Chai Kadai", "Tea Shop Snacks", "Tamil Nadu", "VEG", "Soft sweet bun griddled with butter and fruit jam, a tea-shop classic.", 40),
    ("Podi Uthappam Special", "South Indian Tiffin & Dosa Variations", "Dosa & Tiffin Specials", "Tamil Nadu", "VEG", "Thick crispy uthappam generously topped with idli podi and ghee.", 95),
    ("Ghee Roast", "South Indian Tiffin & Dosa Variations", "Dosa & Tiffin Specials", "Tamil Nadu", "VEG", "Paper-thin golden dosa roasted with pure ghee, served with chutneys and sambar.", 95),
    ("Chicken Kothu Idiyappam", "South Indian Tiffin & Dosa Variations", "Parotta & Chapati Varieties", "Tamil Nadu", "NON_VEG", "Shredded steamed rice noodles stir-fried with spiced chicken masala and egg.", 160),
    ("Nannari Milk Sarbath", "Beverages", "Juices & Traditional Drinks", "Tamil Nadu", "VEG", "Chilled milk blended with fragrant nannari root syrup and sabja seeds.", 55),
    ("Elaneer Juice", "Beverages", "Juices & Traditional Drinks", "South Indian", "VEG", "Chilled tender coconut water blended with soft coconut pulp.", 65),
]


def infer_food_type(name: str, subcat: str, raw_type: str) -> str:
    low = f"{name} {subcat}".lower()
    if any(k in low for k in VEG_OVERRIDE_KEYWORDS):
        # Double check if it also explicitly mentions chicken/mutton/fish/egg
        if any(k in low for k in ("chicken", "mutton", "fish", "prawn", "beef", "lamb", "pork", "crab", "squid", "turkey")):
            return "NON_VEG"
        if "eggless" in low or "chickpea omelette" in low or "miso glazed eggplant" in low:
            return "VEG"
        if any(k in low for k in EGG_KEYWORDS):
            return "EGG"
        return "VEG"
    if any(k in low for k in NON_VEG_KEYWORDS):
        return "NON_VEG"
    if any(k in low for k in EGG_KEYWORDS):
        return "EGG"
    rt = (raw_type or "").strip().lower()
    if rt == "non-veg":
        return "NON_VEG"
    if rt == "egg":
        return "EGG"
    return "VEG"


def infer_image_key(name: str, main_cat: str, subcat: str) -> str:
    low = f"{name} {main_cat} {subcat}".lower()
    if any(k in low for k in ("biryani", "pulao", "mandi", "kabsa", "fried rice", "rice", "khichdi", "sadam", "bath", "pongal", "kuska")):
        if "fried rice" in low or "schezwan" in low or "burnt garlic" in low or "singapore" in low:
            return "chinese_noodles_rice"
        if "milk" in low or "kheer" in low or "payasam" in low:
            return "indian_sweets"
        return "biryani_rice"
    if any(k in low for k in ("tea", "chai", "coffee", "kaapi", "horlicks", "boost", "bournvita", "badam milk", "rose milk", "bun butter", "sukku")):
        return "tea_coffee_snacks"
    if any(k in low for k in ("juice", "milkshake", "shake", "mojito", "cooler", "lassi", "smoothie", "frappe", "soda", "sarbath", "falooda", "jigarthanda", "iced tea", "latte", "espresso", "cappuccino", "americano", "mocha")):
        return "juices_milkshakes"
    if any(k in low for k in ("ice cream", "gelato", "sorbet", "sundae", "kulfi", "bingsu", "waffle", "brownie", "fondue", "panna cotta", "tiramisu", "creme brulee", "pancake", "cheesecake")):
        return "ice_cream_desserts"
    if any(k in low for k in ("jamun", "halwa", "laddu", "mysore pak", "jalebi", "rasgulla", "rasmalai", "payasam", "kheer", "burfi", "peda", "modak", "poli", "mittai", "mithai", "kesari", "palkova", "adhirasam", "athirasam", "baklava", "kunafa")):
        return "indian_sweets"
    if any(k in low for k in ("cake", "pastry", "croissant", "puff", "donut", "muffin", "cupcake", "cookie", "biscuit", "bread", "bun", "danish", "tart", "pie", "rusk", "eclair", "macaron")):
        return "bakery_pastries"
    if any(k in low for k in ("pizza", "pasta", "spaghetti", "fettuccine", "lasagna", "mac and cheese", "risotto", "gnocchi", "ravioli", "garlic bread")):
        return "pizza_pasta"
    if any(k in low for k in ("burger", "sandwich", "wrap", "roll", "shawarma", "burrito", "taco", "quesadilla", "panini", "hot dog", "fries", "nuggets", "sando")):
        return "fast_food_burgers"
    if any(k in low for k in ("puri", "chaat", "samosa", "kachori", "pav bhaji", "vada pav", "dabeli", "bajji", "bonda", "pakoda", "pakora", "maggi", "sundal", "murukku", "mixture")):
        return "street_food_chaat"
    if any(k in low for k in ("soup", "rasam", "broth", "chowder", "bisque", "salad", "raita", "buddha bowl", "poke bowl", "quinoa")):
        return "soups_salads"
    if any(k in low for k in ("noodle", "ramen", "udon", "soba", "manchurian", "chilli ", "hakka", "chow mein", "momos", "dim sum", "dumpling", "sushi", "sashimi", "gyoza", "pad thai", "tteokbokki", "gimbap", "bibimbap", "wonton", "bao")):
        return "chinese_noodles_rice"
    if any(k in low for k in ("fish", "prawn", "crab", "squid", "lobster", "seafood", "meen", "nandu", "nethili", "vanjaram", "sura", "salmon", "tuna", "shrimp", "calamari")):
        return "seafood_specials"
    if any(k in low for k in ("tandoori", "tikka", "kebab", "grill", "bbq", "alfaham", "faham", "shawaya", "65", "555", "lollipop", "wings")):
        return "tandoori_grill"
    if any(k in low for k in ("idli", "dosa", "vada", "uthappam", "upma", "poori", "appam", "idiyappam", "puttu", "paniyaram", "parotta", "sevai", "adai", "pesarattu", "meals", "thali", "paratha", "chole", "chapati", "roti", "phulka")):
        return "south_indian_tiffin"
    if any(k in low for k in ("chicken", "mutton", "beef", "lamb", "pork", "egg", "omelette", "kalakki", "kozhi", "kari", "salna", "korma", "rogan")):
        return "indian_nonveg_curry"
    return "indian_veg_curry"


def clean_description(name: str, main_cat: str, subcat: str, cuisine: str, raw_desc: str) -> str:
    desc = (raw_desc or "").strip()
    bad_markers = (
        "is a bakery selection",
        "is a beverage option",
        "is a soup-style menu item",
        "is a rice-based dish",
        "is a sweet or dessert menu item",
        "is a savoury snack or starter",
        "is a menu selection in the",
        "is a breakfast or tiffin-style item",
        "is a savoury main-course or starter",
        "is a side or accompaniment",
        "is a quick-service or international",
    )
    is_generic = not desc or any(m in desc for m in bad_markers)
    if not is_generic:
        return desc

    low = f"{name} {main_cat} {subcat}".lower()
    if any(k in low for k in ("tea", "chai", "coffee", "kaapi")):
        return f"Freshly brewed {name} served hot in traditional cafe style."
    if any(k in low for k in ("juice", "smoothie", "milkshake", "shake", "cooler", "mojito", "lassi", "sarbath")):
        return f"Chilled {name} prepared fresh to order."
    if any(k in low for k in ("soup", "rasam", "broth")):
        return f"Warm, flavourful {name} simmered with aromatic spices and herbs."
    if any(k in low for k in ("salad", "raita", "chutney", "dip", "sauce")):
        return f"Freshly prepared {name} served as a crisp side or accompaniment."
    if any(k in low for k in ("idli", "dosa", "vada", "uthappam", "pongal", "appam", "idiyappam", "upma", "poori")):
        return f"Classic South Indian {name} served hot with fresh chutneys and sambar."
    if any(k in low for k in ("biryani", "pulao", "mandi", "kabsa")):
        return f"Aromatic spiced {name} cooked with long-grain rice and traditional masala, served with raita."
    if any(k in low for k in ("cake", "pastry", "brownie", "donut", "muffin", "croissant", "cookie", "biscuit")):
        return f"Freshly baked {name} crafted for bakery and cafe takeaway."
    if any(k in low for k in ("ice cream", "gelato", "sorbet", "sundae", "kulfi", "halwa", "jamun", "laddu", "mysore pak", "payasam")):
        return f"Rich, traditional {name} prepared as a sweet dessert treat."
    if any(k in low for k in ("pizza", "pasta", "burger", "sandwich", "wrap", "roll", "shawarma", "taco", "burrito")):
        return f"Made-to-order {name} with fresh fillings and house seasoning."
    if any(k in low for k in ("tandoori", "tikka", "kebab", "grill")):
        return f"Marinated {name} roasted in a clay tandoor or grill, served with mint chutney."
    if any(k in low for k in ("noodle", "ramen", "fried rice", "manchurian", "momos", "sushi")):
        return f"Wok-tossed {name} prepared in Asian restaurant style."
    cuisine_label = f"{cuisine} " if cuisine else ""
    return f"Freshly prepared {cuisine_label}{name} from the {subcat or main_cat} selection."


def main() -> None:
    wb = openpyxl.load_workbook(SOURCE_XLSX, read_only=True, data_only=True)
    ws = wb["All Food Items"]
    rows = list(ws.iter_rows(values_only=True))
    headers = [str(h or "").strip() for h in rows[0]]
    idx = {h: i for i, h in enumerate(headers)}

    seen_names: set[str] = set()
    catalog: list[dict[str, object]] = []

    for row in rows[1:]:
        name = str(row[idx["Food Item Name"]] or "").strip()
        if not name:
            continue
        norm = re.sub(r"\s+", " ", name.lower())
        if norm in seen_names:
            continue
        seen_names.add(norm)

        item_code = str(row[idx["Item ID"]] or "").strip() or f"FE{len(catalog) + 1:05d}"
        main_cat = str(row[idx["Main Category"]] or "").strip() or "General"
        subcat = str(row[idx["Subcategory"]] or "").strip() or main_cat
        cuisine = str(row[idx["Cuisine"]] or "").strip()
        raw_ft = str(row[idx["Food Type"]] or "").strip()
        food_type = infer_food_type(name, subcat, raw_ft)
        desc = clean_description(name, main_cat, subcat, cuisine, str(row[idx["Description"]] or ""))
        image_key = infer_image_key(name, main_cat, subcat)

        price_raw = row[idx["Default Price (INR)"]]
        default_price_inr = int(price_raw) if isinstance(price_raw, (int, float)) and price_raw > 0 else None

        catalog.append(
            {
                "item_code": item_code,
                "name": name,
                "name_ta": TAMIL_NAMES.get(name, ""),
                "main_category": main_cat,
                "subcategory": subcat,
                "cuisine": cuisine,
                "food_type": food_type,
                "description": desc,
                "default_price_inr": default_price_inr,
                "is_bestseller": str(row[idx["Bestseller"]] or "").strip().lower() == "yes",
                "image_key": image_key,
                "image_card": f"/media/catalog/{image_key}_card.webp",
                "image_thumb": f"/media/catalog/{image_key}_thumb.webp",
            }
        )

    next_num = len(catalog) + 1
    for name, main_cat, subcat, cuisine, food_type, desc, price_inr in EXTRA_ITEMS:
        norm = re.sub(r"\s+", " ", name.lower())
        if norm in seen_names:
            continue
        seen_names.add(norm)
        image_key = infer_image_key(name, main_cat, subcat)
        catalog.append(
            {
                "item_code": f"FE{next_num:05d}",
                "name": name,
                "name_ta": TAMIL_NAMES.get(name, ""),
                "main_category": main_cat,
                "subcategory": subcat,
                "cuisine": cuisine,
                "food_type": food_type,
                "description": desc,
                "default_price_inr": price_inr,
                "is_bestseller": False,
                "image_key": image_key,
                "image_card": f"/media/catalog/{image_key}_card.webp",
                "image_thumb": f"/media/catalog/{image_key}_thumb.webp",
            }
        )
        next_num += 1

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")

    # Export cleaned Excel workbook for owner
    out_wb = openpyxl.Workbook()
    out_ws = out_wb.active
    out_ws.title = "Master Food Catalogue"
    out_ws.append(
        [
            "Item Code",
            "Food Item Name",
            "Tamil Name",
            "Main Category",
            "Subcategory",
            "Cuisine",
            "Food Type",
            "Description",
            "Default Price (INR)",
            "Image Group",
            "Card Image Path",
            "Thumb Image Path",
        ]
    )
    for item in catalog:
        out_ws.append(
            [
                item["item_code"],
                item["name"],
                item["name_ta"],
                item["main_category"],
                item["subcategory"],
                item["cuisine"],
                item["food_type"],
                item["description"],
                item["default_price_inr"] or "",
                item["image_key"],
                item["image_card"],
                item["image_thumb"],
            ]
        )
    OUT_XLSX.parent.mkdir(parents=True, exist_ok=True)
    out_wb.save(OUT_XLSX)

    counts = {"VEG": 0, "NON_VEG": 0, "EGG": 0}
    for item in catalog:
        counts[str(item["food_type"])] += 1
    print(f"Built {len(catalog)} clean catalogue items -> {OUT_JSON}")
    print(f"Saved clean Excel -> {OUT_XLSX}")
    print(f"Food type breakdown: {counts}")


if __name__ == "__main__":
    main()
