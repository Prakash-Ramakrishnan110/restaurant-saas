# ADR 0019: Logo Upload Security, WCAG Brand Color Contrast, and QR Standee Architecture

## Status
Accepted

## Date
2026-11-05

## Context
ServeMyFood provides multi-tenant white-label branding, allowing restaurants to display their custom logos, brand colors, bilingual (English/Tamil) table labels, and GST billing credentials on customer bills and printed QR standees.

Allowing user-uploaded files, arbitrary colors, and public QR scans introduces critical security and accessibility challenges:
1. **Malicious File Uploads & XSS**: SVG images can carry embedded `<script>` tags, XML external entity (XXE) attacks, and image bomb attacks.
2. **Decompression Bombs**: Attackers can upload tiny compressed images that expand into gigabytes in memory, exhausting server resources (DoS).
3. **Low Contrast / Unreadable Branding**: Custom brand colors must comply with accessibility standards so text and QR codes remain readable in high-glare restaurant environments.
4. **QR Code Security**: Printed standees must carry signed, tamper-resistant cryptographic tokens rather than vulnerable sequential IDs, and public scans must not expose administrative data.

## Decisions

### 1. Logo Upload Security Pipeline
Logo uploads (`POST /api/v1/business/logo/`) enforce a multi-layer defense-in-depth model:
- **Strict SVG Prohibition**: SVG files are rejected unconditionally both client-side and server-side (checked via file extension, MIME type, and binary header inspection). SVGs are disallowed to eliminate XML/XSS vectors completely. Only PNG, JPEG, and WebP are allowed.
- **Decompression Bomb Protection**: Pillow's `Image.MAX_IMAGE_PIXELS` is capped at 16,000,000 (16 MP). Images exceeding 4000x4000 pixels or 2 MB in file size are rejected immediately with HTTP 400.
- **Image Re-Encoding & EXIF Sanitization**: Uploaded images are re-encoded and saved as clean PNG files without original metadata or EXIF markers.
- **Dual Resolution Variants**: Two variants are generated and stored under random UUID paths scoped to the tenant:
  - `logo_url`: 512×512 px max bounding box (for bills, public pages, large banners).
  - `logo_128_url`: 128×128 px max bounding box (for standees, mobile previews, nav icons).
- **Download Protection**: Logo assets are served with `X-Content-Type-Options: nosniff` headers.

### 2. WCAG 2.1 Brand Primary Color Contrast Invariant
Arbitrary hex colors for `brand_primary_color` are evaluated against standard background anchors:
- Contrast ratio is computed against White (`#FFFFFF`) and Navy (`#0B1F3B`) per WCAG 2.1 relative luminance formulas.
- The color is accepted if and only if:
  $$\max(\text{contrast}(\text{color}, \text{white}), \text{contrast}(\text{color}, \text{navy})) \ge 4.5$$
- Colors failing this threshold (e.g. mid-grays such as `#808080`) are rejected by the backend with HTTP 400 (`INVALID_BRAND_COLOR`) and flagged in the frontend with live contrast badges.

### 3. QR Code Generation, Rotation, and A4 Browser Printing
- **High Error Correction for Branding**: Branded QR codes use QR Error Correction Level H (~30% redundancy) and embed the tenant's logo scaled to $\le 20\%$ of the QR width, backed by a white rounded boundary to preserve high contrast and scan reliability.
- **OpenCV Decodability**: All generated QR codes are verified across resolutions and colors using OpenCV (`cv2.QRCodeDetector`).
- **Cryptographic Rotation**: Calling `POST /api/v1/qr-codes/{id}/rotate/` generates a fresh cryptographic token (via `secrets.token_urlsafe(32)`), updates `token_updated_at`, and invalidates prior tokens immediately.
- **Standard A4 Browser Printing**: Dedicated CSS print styling (`@media print`, `@page { size: A4 portrait; margin: 8mm; }`) formats 6 large standees (2×3 grid) or 12 compact tent cards (3×4 grid) per page with dashed cut lines and bilingual (English/Tamil) labels. Browser navigation bars, headers, and buttons are tagged `.no-print` and cleanly hidden during print.

### 4. Public QR Landing Security (`GET /api/v1/public/qr/{token}/`)
When a customer scans a table or counter QR standee:
- If the token is invalid, deactivated, or points to a suspended tenant, the endpoint returns a generic 404.
- If valid, only guest-facing information is exposed (`tenant_name`, `display_name`, `logo_url`, `brand_primary_color`, `table_identifier`, `area_name`, `branch_name`). No internal IDs, database primary keys, tenant settings, or staff details are leaked.
- The public page displays a polite notice informing guests that digital ordering is launching soon and directing them to venue staff.

## Consequences
- **Positive**: Complete mitigation of SVG-based XSS and image decompression DoS attacks.
- **Positive**: Guaranteed readability and WCAG AA contrast compliance across light and dark backgrounds.
- **Positive**: QR standees scan rapidly and reliably on customer mobile devices.
- **Positive**: Inexpensive in-house printing without requiring specialized thermal standee software.
