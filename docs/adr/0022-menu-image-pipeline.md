# ADR 0022: Menu Image Ingestion, Security Sanitization, and Crop Pipeline

## Status
Accepted

## Context
Food imagery is central to digital restaurant menus and customer ordering conversions. However, user-uploaded image files represent a primary attack vector (malicious SVGs containing embedded JavaScript, polyglot files, server memory exhaustion via decompression bombs, and accidental privacy leaks via embedded EXIF geolocation data). Furthermore, unoptimized multi-megabyte camera photos degrade mobile performance on spotty cellular connections.

## Decision

1. **Strict Format Whitelist and Magic-Byte Verification**:
   - Only `JPEG`, `PNG`, and `WebP` MIME types are permitted.
   - Vector graphics (`SVG`), PDFs, TIFFs, and executable payloads are rejected at upload validation time with `INVALID_IMAGE_FORMAT` (HTTP 400).
   - Validation uses Pillow `Image.open` and `.verify()` to inspect true image magic bytes, rather than relying solely on file extensions or client-supplied `Content-Type` headers.
   - Max file upload size is capped at 5 MB.

2. **Metadata Sanitization (EXIF & GPS Stripping)**:
   - To eliminate privacy risks (such as camera GPS coordinates or device identifiers), the image processing pipeline re-encodes pure pixel data into a new Pillow buffer, discarding all auxiliary metadata tags.

3. **Multi-Resolution WebP Artifact Generation**:
   - Every uploaded image produces three optimized artifacts stored in tenant-isolated paths:
     1. **Clean Original**: Downscaled if the max dimension exceeds 2,000px, recompressed as WebP.
     2. **Card Image (800x600 WebP)**: Cropped to a 4:3 aspect ratio centered around user-defined focal coordinates `(focus_x, focus_y)`.
     3. **Thumbnail (300x300 WebP)**: Square crop centered on the focal point for rapid list rendering and POS order displays.

4. **Tenant Storage Entitlement Enforcement**:
   - Total byte consumption for all image artifacts is tracked per `MenuItem.image_bytes`.
   - The total tenant storage is evaluated against the `max_image_storage_mb` entitlement key prior to persistence. Over-limit requests raise `ENTITLEMENT_LIMIT_REACHED` (HTTP 403).

## Consequences
- **Positive**: Complete mitigation of SVG XSS attacks and EXIF metadata leakage. Optimal mobile load times with WebP compression. Fast rendering on low-bandwidth mobile networks.
- **Negative**: Requires Pillow dependency and CPU cycles during upload processing.

