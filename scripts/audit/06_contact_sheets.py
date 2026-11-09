"""
Audit Step 6: Contact Sheets Builder
Assembles docs/audit/contact-sheet-desktop.png and docs/audit/contact-sheet-mobile.png
from screenshots in docs/audit/screens/.
"""

import os
import sys
import glob
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
SCREENS_DIR = os.path.join(BASE_DIR, "docs/audit/screens")
DESKTOP_OUTPUT = os.path.join(BASE_DIR, "docs/audit/contact-sheet-desktop.png")
MOBILE_OUTPUT = os.path.join(BASE_DIR, "docs/audit/contact-sheet-mobile.png")

def create_contact_sheet(images, output_path, cols=4, thumb_w=360, thumb_h=225, label_h=35):
    if not images:
        print(f"No images found for {output_path}. Creating blank placeholder.")
        img = Image.new("RGB", (800, 200), color=(240, 240, 240))
        d = ImageDraw.Draw(img)
        d.text((50, 90), f"No screenshots captured yet for {os.path.basename(output_path)}", fill=(50, 50, 50))
        img.save(output_path)
        return

    rows = (len(images) + cols - 1) // cols
    sheet_w = cols * thumb_w + (cols + 1) * 15
    sheet_h = rows * (thumb_h + label_h) + (rows + 1) * 15

    sheet = Image.new("RGB", (sheet_w, sheet_h), color=(245, 247, 250))
    draw = ImageDraw.Draw(sheet)

    try:
        font = ImageFont.load_default()
    except Exception:
        font = None

    for idx, (img_path, label) in enumerate(images):
        r = idx // cols
        c = idx % cols
        x = 15 + c * (thumb_w + 15)
        y = 15 + r * (thumb_h + label_h + 15)

        try:
            with Image.open(img_path) as im:
                im = im.convert("RGB")
                im.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
                # Paste thumbnail centered in cell
                offset_x = x + (thumb_w - im.width) // 2
                offset_y = y + (thumb_h - im.height) // 2
                sheet.paste(im, (offset_x, offset_y))
                # Border around thumbnail
                draw.rectangle([x, y, x + thumb_w, y + thumb_h], outline=(200, 205, 215), width=1)
        except Exception as e:
            draw.rectangle([x, y, x + thumb_w, y + thumb_h], fill=(230, 230, 230), outline=(200, 205, 215))
            draw.text((x + 10, y + 50), f"Error loading:\n{e}", fill=(200, 50, 50), font=font)

        # Label text
        label_y = y + thumb_h + 5
        # Truncate label if too long
        display_label = label if len(label) < 45 else label[:42] + "..."
        draw.text((x + 5, label_y), display_label, fill=(20, 30, 50), font=font)

    sheet.save(output_path, "PNG", optimize=True)
    print(f"Created {output_path} ({sheet_w}x{sheet_h}, {len(images)} images)")

def main():
    all_pngs = sorted(glob.glob(os.path.join(SCREENS_DIR, "*.png")))

    desktop_images = []
    mobile_images = []

    for p in all_pngs:
        fname = os.path.basename(p)
        if "contact-sheet" in fname:
            continue
        if "mobile" in fname or "phone" in fname or "touch" in fname:
            label = fname.replace(".png", "").replace("_", " ")
            mobile_images.append((p, label))
        else:
            label = fname.replace(".png", "").replace("_", " ")
            desktop_images.append((p, label))

    print(f"Found {len(desktop_images)} desktop screens and {len(mobile_images)} mobile screens.")

    create_contact_sheet(desktop_images, DESKTOP_OUTPUT, cols=4, thumb_w=340, thumb_h=212, label_h=30)
    create_contact_sheet(mobile_images, MOBILE_OUTPUT, cols=5, thumb_w=200, thumb_h=380, label_h=30)

if __name__ == "__main__":
    main()
