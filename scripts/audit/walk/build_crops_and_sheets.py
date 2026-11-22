"""Generate 8 grouped contact sheets (mobile + desktop per flow group) and 28 UI polish crops + ui-polish.md."""
import json
import os
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
RAW_PATH = os.path.join(BASE_DIR, "docs/audit/walk/raw/walk_raw.json")
SHEETS_DIR = os.path.join(BASE_DIR, "docs/audit/walk/sheets")
CROPS_DIR = os.path.join(BASE_DIR, "docs/audit/walk/crops")
POLISH_MD = os.path.join(BASE_DIR, "docs/audit/walk/ui-polish.md")

os.makedirs(SHEETS_DIR, exist_ok=True)
os.makedirs(CROPS_DIR, exist_ok=True)

with open(RAW_PATH, encoding="utf-8") as f:
    walk = json.load(f)

GROUPS = {
    "group1_customer_qr": [f"F-0{i}" for i in range(1, 9)],
    "group2_floor_kitchen_ops": [f"F-0{i}" for i in range(9, 10)] + [f"F-{i}" for i in range(10, 14)],
    "group3_billing_hotel_counter": [f"F-{i}" for i in range(14, 23)],
    "group4_management_admin": [f"F-{i}" for i in range(23, 29)],
}


def build_contact_sheet(items, out_path, is_mobile):
    cols = 4 if is_mobile else 3
    thumb_w = 210 if is_mobile else 340
    thumb_h = 440 if is_mobile else 212
    label_h = 34
    pad = 12
    rows = max(1, (len(items) + cols - 1) // cols)
    sw = cols * thumb_w + (cols + 1) * pad
    sh = rows * (thumb_h + label_h) + (rows + 1) * pad

    sheet = Image.new("RGB", (sw, sh), (244, 246, 250))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for idx, entry in enumerate(items):
        r, c = divmod(idx, cols)
        x = pad + c * (thumb_w + pad)
        y = pad + r * (thumb_h + label_h + pad)
        img_abs = os.path.join(BASE_DIR, entry["shotPath"])
        if os.path.exists(img_abs):
            with Image.open(img_abs) as im:
                im = im.convert("RGB")
                im.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
                ox = x + (thumb_w - im.width) // 2
                oy = y + (thumb_h - im.height) // 2
                sheet.paste(im, (ox, oy))
        draw.rectangle([x, y, x + thumb_w, y + thumb_h], outline=(190, 198, 210), width=1)
        lbl = f"{entry['flowId']} | {entry['stepId']} [{entry['status']}]"
        if len(lbl) > 42:
            lbl = lbl[:39] + "..."
        color = (180, 30, 30) if entry["status"] != "PASS" else (20, 30, 50)
        draw.text((x + 4, y + thumb_h + 6), lbl, fill=color, font=font)

    sheet.save(out_path, "JPEG", quality=82, optimize=True)


for gname, fids in GROUPS.items():
    for vp_name, is_mob in [("mobile", True), ("desktop", False)]:
        items = [
            x
            for x in walk
            if x["flowId"] in fids and x["viewport"] in (vp_name, "390x844" if is_mob else "1440x900")
        ]
        out_file = os.path.join(SHEETS_DIR, f"{gname}_{vp_name}.jpg")
        build_contact_sheet(items, out_file, is_mob)
        print(f"Sheet: {out_file} ({len(items)} frames)")


def find_step(flow_id, step_prefix, vp="mobile"):
    alt = "390x844" if vp in ("mobile", "390x844") else "1440x900"
    norm = "mobile" if vp in ("mobile", "390x844") else "desktop"
    for x in walk:
        if x["flowId"] == flow_id and x["stepId"].startswith(step_prefix) and x["viewport"] in (norm, alt):
            return x
    return None


def save_crop(entry, box, out_name):
    if not entry:
        return None
    src = os.path.join(BASE_DIR, entry["shotPath"])
    if not os.path.exists(src):
        return None
    with Image.open(src) as im:
        w, h = im.size
        x0 = max(0, min(w - 20, box[0]))
        y0 = max(0, min(h - 20, box[1]))
        x1 = max(x0 + 20, min(w, box[2]))
        y1 = max(y0 + 20, min(h, box[3]))
        cropped = im.crop((x0, y0, x1, y1))
        out_path = os.path.join(CROPS_DIR, out_name)
        cropped.save(out_path, "PNG", optimize=True)
    return f"crops/{out_name}"


def bbox_from_item(item, pad=18):
    x = int(item.get("x", 0))
    y = int(item.get("y", 0))
    w = max(40, int(item.get("w", 120)))
    h = max(30, int(item.get("h", 40)))
    return (x - pad, y - pad, x + w + pad + 80, y + h + pad + 20)


defects = []


def add_defect(fid, step_pref, vp, category, title, detail, box_fn):
    e = find_step(fid, step_pref, vp)
    if not e:
        return
    box = box_fn(e)
    idx = len(defects) + 1
    fname = f"polish_{idx:02d}_{fid.lower()}.png"
    rel = save_crop(e, box, fname)
    if rel:
        defects.append(
            {
                "id": f"UI-{idx:02d}",
                "flow": fid,
                "step": e["stepId"],
                "viewport": vp,
                "category": category,
                "title": title,
                "detail": detail,
                "crop": rel,
                "shot": e["shotPath"],
            }
        )


# 1-28 concrete defects grounded in actual walk_raw entries & screenshots
add_defect("F-04", "02-awaiting-payment", "390x844", "Clipped Text", "Tracker branch summary clipped with ellipsis on mobile", "Branch + order number + token string truncates at right edge (`Foodie Plaza Central • #ORD-... • Token...`).", lambda e: (20, 440, 370, 540))
add_defect("F-04", "02-awaiting-payment", "390x844", "Orange Accent Rule", "Counter token # rendered in bright orange text", "Token number rendered in `#FF6A00` orange text rather than neutral/navy.", lambda e: (20, 90, 370, 240))
add_defect("F-01", "01-browse-en", "390x844", "Tap Target < 56px", "Guest Tamil language toggle height is 44px (< 56px touch minimum)", "Mobile touch mode requires 56px tap target; language toggle measures 65x44px.", lambda e: (290, 0, 390, 75))
add_defect("F-01", "01-browse-en", "390x844", "Text < 12px", "Table label subtext below 12px on Customer QR header", "`Table V1` badge renders at 11px.", lambda e: (40, 20, 240, 75))
add_defect("F-01", "02-browse-ta", "390x844", "Missing Tamil Strings", "Dish names and descriptions stay in English when Tamil is selected", "Royal Dum Pukht menu cards show untranslated English dish names/descriptions in `தமிழ்` mode.", lambda e: (10, 280, 380, 620))
add_defect("F-09", "03-first-order-fired", "390x844", "Overlap / Alignment", "Success toast overlaps Floor POS header and shift banner on mobile", "Green toast (`Table T5 seated with 4 guests.`) collides over `FLOOR TABLES`, `Transfer`, and `Shift: FULL DAY`.", lambda e: (10, 50, 380, 175))
add_defect("F-09", "02-table-seated", "390x844", "Unclear / Rule-Violating Label", "Seating modal CTA exposes forbidden internal word 'Open Dining Session'", "Waiter modal button reads `Open Dining Session` instead of `Seat Guests`.", lambda e: (15, 420, 375, 560))
add_defect("F-22", "01-counter-pos", "390x844", "Clipped Button", "'Fire Order to Kitchen' CTA clipped behind bottom navigation bar", "Primary submit button at bottom of Counter Orders extends underneath the fixed bottom tab bar.", lambda e: (10, 720, 380, 844))
add_defect("F-22", "01-counter-pos", "390x844", "Contrast < 4.5:1 / Orange Text", "Active Daily Token '#101' rendered in low-contrast orange text on white", "`#101` uses `#FF6A00` on white (`2.87:1` contrast).", lambda e: (40, 130, 350, 280))
add_defect("F-21", "01-rooms-list", "390x844", "Clipped Text", "Rooms search input placeholder truncated to 'Sea' and filter pill 'CI...' clipped", "Narrow mobile grid squeezes search input placeholder and overflows status filter chips horizontally.", lambda e: (30, 650, 360, 800))
add_defect("F-21", "01-rooms-list", "390x844", "Confusing Label / Orange Text", "Internal problem IDs '(H-03, H-05)' and orange Housekeeping metric", "Subheading exposes `(H-03, H-05)` and card uses amber/orange text `#B45309`.", lambda e: (20, 80, 370, 230))
add_defect("F-17", "02-room-charges-folio", "390x844", "Clipped Text / Forbidden Jargon", "Room Charges Folio shows 'PMS posting', '(H-05)', and clipped placeholder", "Subtitle exposes `PMS` and `(H-05)`, while search input clips `Search room number, invoice`.", lambda e: (20, 75, 370, 240))
add_defect("F-23", "01-dashboard", "390x844", "Contrast < 4.5:1", "Brand wordmark 'Food' in orange `#FF6A00` fails 4.5:1 contrast (2.87:1)", "Top AppShell brand text `Food` on white has 2.87:1 contrast across all staff screens.", lambda e: (50, 0, 220, 56))
add_defect("F-23", "01-dashboard", "390x844", "Tap Target < 56px", "Mobile sidebar menu toggle button is 40x40px (< 56px touch minimum)", "Top-left hamburger icon measures 40x40px on mobile touch viewport.", lambda e: (0, 0, 70, 56))
add_defect("F-23", "01-dashboard", "390x844", "Orange Status / Line Wrap", "Dashboard uses orange status/warning accents and wraps date '2026-11-22'", "`Occupied`, `View Floor →`, `SPICE GARDEN`, and delay warning use orange; date breaks across lines.", lambda e: (15, 250, 375, 760))
add_defect("F-25", "03-availability", "1440x900", "Broken Image / Empty Frame", "Dish thumbnails fail to render (`naturalWidth === 0`) on Menu Availability", "Broken image icons appear next to menu items.", lambda e: (250, 210, 700, 700))
add_defect("F-25", "01-menu", "390x844", "Broken Image", "Dish thumbnail fails to load in mobile Menu Manager", "Broken image placeholder visible in item card.", lambda e: (0, 620, 260, 790))
add_defect("F-12", "03-sold-out-switches", "1440x900", "Broken Screen State", "Kitchen sees 'Failed to load availability data.' error on Today's Availability", "Screen fails with 403 `/api/v1/branches/` for Kitchen role even though link is in Kitchen sidebar.", lambda e: (240, 80, 1100, 300))
add_defect("F-14", "01-billing-queue", "1440x900", "Unclear Jargon", "Billing empty state exposes 'ACTIVE DINING SESSIONS (0)' and 'table session'", "Staff cashier UI repeats technical term `session` instead of plain `Table` or `Bill`.", lambda e: (260, 170, 1280, 520))
add_defect("F-16", "01-awaiting-list", "390x844", "Wrong Venue Wording", "Counter venue Billing screen displays forbidden word 'Table' on Foodie Plaza", "Counter-only venue renders `Table` wording on Billing queue.", lambda e: (10, 90, 380, 560))
add_defect("F-27", "03-branding", "390x844", "Forbidden Policy Wording", "Branding subtitle promises 'GST billing credentials' against tax policy", "Branding card explicitly mentions GST billing credentials.", lambda e: (10, 70, 380, 260))
add_defect("F-28", "01-admin-home", "1440x900", "Unclear / Internal Jargon", "Admin dashboard exposes 'Tenants', 'Inspect Telemetry →' orange link, DB internals", "Exposes `Tenants`, `Port 5432`, `Tables: 74`, and orange link text instead of `Customers`.", lambda e: (260, 80, 1250, 660))
add_defect("F-28", "03-new-tenant", "1440x900", "Internal Jargon / Text < 12px", "New Customer wizard exposes 'PRESET' and 'Tenants' labels", "Internal capability preset terminology exposed in wizard UI.", lambda e: (260, 80, 1180, 520))
add_defect("F-23", "08-customers", "1440x900", "Layout / Data Exposure", "Customers VIP Loyalty page exposes loyalty points ahead of plan", "Customers CRM includes VIP loyalty point metrics and unlocalized handle text.", lambda e: (260, 80, 1300, 500))
add_defect("F-23", "10-activity", "1440x900", "Raw Key Wording", "Activity Log displays raw event codes (`order.qr_rejected`, `qr.rotate`)", "Human-readable descriptions missing for raw dot-separated audit codes.", lambda e: (260, 180, 1250, 620))
add_defect("F-13", "01-ready-and-requests", "390x844", "Persistent Skeleton / Spinner", "Ready to Serve spinner/skeleton remained active after 10s check", "Initial loading placeholder detected still active beyond 10s threshold.", lambda e: (10, 80, 380, 520))
add_defect("F-27", "02-roles-guide", "390x844", "Text < 12px / Spacing", "Roles Guide renders sub-12px micro badges and Tamil jargon", "Role flow arrows and metadata badges drop to 10px.", lambda e: (10, 160, 380, 640))
add_defect("F-25", "04-translations", "1440x900", "Missing Tamil Strings", "Translations screen chrome and sidebar stay completely English in Tamil review", "All navigation labels (`Dashboard`, `Live Orders`, `Bills`, `Online`, `Support`) remain untranslated.", lambda e: (0, 0, 520, 680))

lines = [
    "# UI Polish Defects Catalog",
    "",
    f"Generated from real Playwright captures across `390x844` (mobile touch) and `1440x900` (desktop). Total concrete defects documented with cropped evidence: **{len(defects)}**.",
    "",
    "| ID | Flow | Step | Viewport | Category | Defect | Cropped Evidence |",
    "|---|---|---|---|---|---|---|",
]
for d in defects:
    lines.append(
        f"| {d['id']} | {d['flow']} | `{d['step']}` | {d['viewport']} | {d['category']} | **{d['title']}** — {d['detail']} | [{d['crop']}]({d['crop']}) |"
    )

with open(POLISH_MD, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"Wrote {POLISH_MD} with {len(defects)} cropped UI polish defects.")
