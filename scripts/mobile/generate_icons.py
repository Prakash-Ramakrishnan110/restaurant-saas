"""Generate Android adaptive launcher icons & navy splash screen from ServeMyFood icon."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent.parent
SRC_ICON = ROOT / "frontend" / "public" / "icons" / "icon-512.png"
RES_DIR = ROOT / "mobile" / "android" / "app" / "src" / "main" / "res"

NAVY = (11, 31, 59, 255)  # #0B1F3B

DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

FOREGROUND_DENSITIES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}


def main() -> None:
    if not SRC_ICON.exists():
        raise FileNotFoundError(f"Source icon not found: {SRC_ICON}")

    src = Image.open(SRC_ICON).convert("RGBA")

    for density, size in DENSITIES.items():
        out_dir = RES_DIR / f"mipmap-{density}"
        out_dir.mkdir(parents=True, exist_ok=True)

        # Square launcher icon on navy background
        sq = Image.new("RGBA", (size, size), NAVY)
        inner = src.resize((int(size * 0.78), int(size * 0.78)), Image.Resampling.LANCZOS)
        offset = ((size - inner.width) // 2, (size - inner.height) // 2)
        sq.paste(inner, offset, inner)
        sq.save(out_dir / "ic_launcher.png", "PNG")

        # Round launcher icon
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        rnd = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        rnd.paste(sq, (0, 0), mask)
        rnd.save(out_dir / "ic_launcher_round.png", "PNG")

    for density, size in FOREGROUND_DENSITIES.items():
        out_dir = RES_DIR / f"mipmap-{density}"
        out_dir.mkdir(parents=True, exist_ok=True)
        fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        inner = src.resize((int(size * 0.62), int(size * 0.62)), Image.Resampling.LANCZOS)
        offset = ((size - inner.width) // 2, (size - inner.height) // 2)
        fg.paste(inner, offset, inner)
        fg.save(out_dir / "ic_launcher_foreground.png", "PNG")

    # Navy splash screen
    drawable = RES_DIR / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)
    splash = Image.new("RGBA", (1080, 1920), NAVY)
    logo = src.resize((360, 360), Image.Resampling.LANCZOS)
    splash.paste(logo, ((1080 - 360) // 2, (1920 - 360) // 2), logo)
    splash.save(drawable / "splash.png", "PNG")
    print("Generated Android adaptive icons and splash screen.")


if __name__ == "__main__":
    main()
