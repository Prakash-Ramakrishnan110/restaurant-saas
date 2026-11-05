import re

from apps.core.exceptions import BusinessRuleError


def parse_hex_color(hex_str: str) -> tuple[int, int, int]:
    """Parse #RGB or #RRGGBB into (r, g, b) tuple."""
    if not isinstance(hex_str, str):
        raise ValueError("Color must be a string.")
    hex_clean = hex_str.strip().lstrip("#")
    if len(hex_clean) == 3:
        hex_clean = "".join(c * 2 for c in hex_clean)
    if len(hex_clean) != 6 or not re.match(r"^[0-9a-fA-F]{6}$", hex_clean):
        raise ValueError("Invalid hex color format.")
    num = int(hex_clean, 16)
    return (num >> 16) & 255, (num >> 8) & 255, num & 255


def relative_luminance(r: int, g: int, b: int) -> float:
    """Calculates relative luminance per WCAG 2.1."""

    def channel(c: int) -> float:
        val = c / 255.0
        return val / 12.92 if val <= 0.03928 else ((val + 0.055) / 1.055) ** 2.4

    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast_ratio(hex1: str, hex2: str) -> float:
    """Computes contrast ratio between two hex colors."""
    r1, g1, b1 = parse_hex_color(hex1)
    r2, g2, b2 = parse_hex_color(hex2)
    l1 = relative_luminance(r1, g1, b1)
    l2 = relative_luminance(r2, g2, b2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def validate_brand_primary_color(color_hex: str) -> str:
    """Validates brand color hex and ensures >= 4.5:1 contrast against white or navy."""
    try:
        parse_hex_color(color_hex)
    except ValueError:
        raise BusinessRuleError(
            "INVALID_BRAND_COLOR",
            "Invalid hex color format.",
            status_code=400,
        ) from None

    clean_hex = color_hex.strip()
    if not clean_hex.startswith("#"):
        clean_hex = f"#{clean_hex}"
    clean_hex = clean_hex.upper()

    ratio_white = contrast_ratio(clean_hex, "#FFFFFF")
    ratio_navy = contrast_ratio(clean_hex, "#0B1F3B")

    if max(ratio_white, ratio_navy) < 4.5:
        raise BusinessRuleError(
            "INVALID_BRAND_COLOR",
            "Brand primary color must reach at least 4.5:1 contrast against white or navy.",
            status_code=400,
            details={
                "contrast_against_white": round(ratio_white, 2),
                "contrast_against_navy": round(ratio_navy, 2),
            },
        )
    return clean_hex


GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


def validate_gstin(gstin: str) -> str:
    """Validates standard 15-character Indian GSTIN structure."""
    if not gstin:
        return ""
    cleaned = gstin.strip().upper()
    if not cleaned:
        return ""
    if len(cleaned) != 15 or not GSTIN_REGEX.match(cleaned):
        raise BusinessRuleError(
            "INVALID_GSTIN",
            "GSTIN must be a valid 15-character structure (e.g. 33AAAAA0000A1Z5).",
            status_code=400,
            details={"value": gstin},
        )
    return cleaned

