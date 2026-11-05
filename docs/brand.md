# ServeMyFood Brand & Design System Guide

> **"One Platform. Every Food Business."**  
> Developed by **Fusion Engine Technology**

---

## 1. Brand Identity

- **Brand Name**: ServeMyFood
- **Wordmark Styling**: "ServeMy" in Deep Navy (`#0B1F3B`) on light surfaces / Pure White (`#FFFFFF`) on dark surfaces, followed by "Food" in Vibrant Orange (`#FF6A00`) in Poppins Bold.
- **Icon / Mark**: Simple chef's hat mark with fork and spoon.
  - Light backgrounds: `mark-orange.svg` (`#FF6A00` chef's hat mark).
  - Dark backgrounds: `mark-white.svg` (`#FFFFFF` chef's hat mark).
  - Favicon (16/32px): `favicon-simple.svg`.
  - App icon (180/192/512px): `app-icon.svg` (orange tile with white chef's hat mark).
- **Clear Space**: Clear space of half the hat width on all sides.
- **Minimum Dimensions**:
  - Mark: Minimum width `24 px`.
  - Full Logo: Minimum width `120 px`.
- **Artwork Finalization**: A designer must finalise the master artwork before launch.
- **Tagline**: *"One Platform. Every Food Business."*
- **Company**: Fusion Engine Technology (`fusionengine.in`)

---

## 2. Color Palette & WCAG Contrast Invariants

### Primary & Accent Colors
| Role | Hex | RGB | Usage | Contrast / Invariant |
|---|---|---|---|---|
| **Primary Orange** | `#FF6A00` | `255, 106, 0` | Primary buttons, active tabs, brand accents | **CRITICAL**: Use Navy (`#0B1F3B`) text (**5.7:1**, AAA). **NEVER** use white text (3.0:1 fails AA). |
| **Deep Navy** | `#0B1F3B` | `11, 31, 59` | Text on primary orange, headings, dark mode surfaces | Provides **14.2:1** contrast against white backgrounds. |
| **Darker Orange** | `#C2410C` | `194, 65, 12` | Orange text, badges, borders on light backgrounds | Provides **4.8:1** contrast on white (WCAG AA compliant). |
| **Danger Red** | `#DC2626` | `220, 38, 38` | Destructive buttons, error alerts, deactivations | Provides **4.6:1** contrast on white (WCAG AA compliant). |
| **Amber Warning** | `#D97706` | `217, 119, 6` | Warning meters (80%–99%), caution notices | Never use brand orange for warning states. |
| **Warm Cream** | `#FFF3E0` | `255, 243, 224` | Auth desktop side panel, empty state backgrounds | Warm, welcoming hospitality visual tone. |

### Operational Status Colors (Tables & Orders)
| Status | Background Hex | Text / Border Hex | Contrast Ratio |
|---|---|---|---|
| `AVAILABLE` | `#DCFCE7` (Green 100) | `#15803D` (Green 700) | **4.9:1** on light surface |
| `OCCUPIED` | `#DBEAFE` (Blue 100) | `#1D4ED8` (Blue 700) | **5.1:1** on light surface |
| `RESERVED` | `#F3E8FF` (Purple 100) | `#7E22CE` (Purple 700) | **5.3:1** on light surface |
| `CLEANING` | `#FEF3C7` (Amber 100) | `#B45309` (Amber 700) | **4.6:1** on light surface |
| `BLOCKED` | `#F3F4F6` (Gray 100) | `#374151` (Gray 700) | **6.2:1** on light surface |

---

## 3. Typography

| Font Family | Usage | Weights | Fallback |
|---|---|---|---|
| **Poppins** | Headings (`h1`-`h4`), Brand mark, Primary CTA buttons | 600 (Semi-bold), 700 (Bold) | `system-ui, sans-serif` |
| **Inter** | Body text, forms, data tables, metrics, navigation | 400 (Regular), 500 (Medium), 600 (Semi-bold) | `system-ui, sans-serif` |
| **Noto Sans Tamil** | Tamil localization text (`ta`) | 400 (Regular), 600 (Semi-bold) | `sans-serif` |

All fonts are self-hosted in WOFF2 format under `/frontend/public/fonts/`.

---

## 4. Logo Clear Space and Minimum Sizes

- **Full Wordmark**:
  - Minimum width: `120 px`.
  - Clear space: Minimum padding equal to half the chef's hat width on all sides.
- **Icon / Mark**:
  - Minimum width: `24 px`.
  - Favicon formats: `16x16px`, `32x32px`, `180x180px` (Apple touch), `192x192px` (PWA), `512x512px` (PWA).
- **Master Artwork**: A designer must finalise the master artwork before launch.

---

## 5. Accessibility Checklist

- [x] All button and link text meets or exceeds WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text).
- [x] Primary Orange button text is strictly Navy (`#0B1F3B`), yielding 5.7:1 (WCAG AAA compliant).
- [x] Form inputs include explicit `<label>` tags with `for` associations.
- [x] All interactive elements have focus indicators (`focus-visible:ring-2 focus-visible:ring-[#FF6A00]`).
- [x] Minimum touch target size is 56px in touch mode and across waiter/kitchen tablet interfaces.
- [x] Automated WCAG contrast ratio test suite in Vitest.
