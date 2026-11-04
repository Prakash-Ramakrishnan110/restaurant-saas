# ServeMyFood Design System & Component Guidelines

## 1. Design Principles
1. **Accessibility First**: WCAG 2.1 AA compliance across all components. High-contrast typography and clear visual cues.
2. **Touch-Ready & Ergonomic**: Optimized for kitchen displays, POS terminals, and mobile devices with >= 44px comfortable touch targets and >= 56px touch mode targets.
3. **Clarity & Focus**: Minimal clutter, unambiguous table status colors, and deterministic feedback on all user mutations.
4. **Resilient & Transparent**: Immediate offline indicators, clear error banners with actionable resolution steps, and zero silent failures.

---

## 2. Brand Tokens & Color Palette

### 2.1 Primary Action Tokens
- **Brand Primary**: `#FF6A00` (Vibrant Orange)
- **Brand Primary Text / Foreground**: `#0B1F3B` (Deep Navy) — Contrast ratio: **5.7:1** (WCAG AAA for text).
  > **STRICT INVARIANT**: White text on `#FF6A00` is strictly forbidden (2.87:1 fails WCAG AA).
- **Brand Darker Orange**: `#C2410C` (Used for orange text on white backgrounds, >= 4.5:1 contrast).
- **Brand Danger**: `#DC2626` (Crimson Red for destructive actions, >= 4.5:1 contrast).
- **Warm Cream Background**: `#FFF3E0` (Subtle warm tint for authentication and empty state illustrations).

### 2.2 Table Status Semantic Tokens
Orange is **NEVER** used for status or warning badges to prevent collision with the primary brand color.
- `AVAILABLE`: Forest Green (`#16A34A` text, `#DCFCE7` background)
- `OCCUPIED`: Royal Blue (`#2563EB` text, `#DBEAFE` background)
- `RESERVED`: Purple (`#9333EA` text, `#F3E8FF` background)
- `CLEANING`: Amber (`#D97706` text, `#FEF3C7` background)
- `BLOCKED`: Slate Gray (`#4B5563` text, `#F3F4F6` background)

---

## 3. Typography
- **Headings & Callouts**: `Poppins, sans-serif` (weight: 500, 600, 700)
- **Body, Inputs & Data Tables**: `Inter, sans-serif` (weight: 400, 500, 600) with `font-feature-settings: 'tnum'` for tabular numbers.
- **Tamil Regional Script**: `Noto Sans Tamil, sans-serif`

---

## 4. UI Components Catalog

| Component | Path | Description |
|---|---|---|
| `Button` | `src/components/ui/button.tsx` | Primary, secondary, outline, ghost, destructive, link variants. |
| `IconButton` | `src/components/ui/icon-button.tsx` | Accessible icon-only button with mandatory `aria-label` and tooltip. |
| `Input` | `src/components/ui/input.tsx` | Standard text, number, email inputs with focus ring and error states. |
| `PasswordInput` | `src/components/ui/password-input.tsx` | Secure password field with reveal/hide eye toggle. |
| `Select` | `src/components/ui/select.tsx` | Custom dropdown select menu built on Radix UI. |
| `Combobox` | `src/components/ui/combobox.tsx` | Searchable autocomplete combobox. |
| `Switch` | `src/components/ui/switch.tsx` | Accessible toggle switch for boolean preferences. |
| `Checkbox` | `src/components/ui/checkbox.tsx` | Radix-based tri-state capable checkbox with focus outline. |
| `RadioCard` | `src/components/ui/radio-card.tsx` | Card-style selectable radio button for venue presets and roles. |
| `Sheet` | `src/components/ui/sheet.tsx` | Slide-over drawer for mobile navigation and detailed panels. |
| `ConfirmDialog` | `src/components/ui/confirm-dialog.tsx` | Modal confirmation for destructive operations (delete table, reset password). |
| `Toast` | `src/components/ui/toast.tsx` | Transient notification banners (success, error, info). |
| `Tooltip` | `src/components/ui/tooltip.tsx` | Hover/focus explanation tooltips. |
| `StatusBadge` | `src/components/app/StatusBadge.tsx` | Status pill with icon, text, and accessible status tokens. |
| `EmptyState` | `src/components/app/EmptyState.tsx` | Clean empty state with icon, heading, description, and primary CTA. |
| `Skeleton` | `src/components/ui/skeleton.tsx` | Animated loading placeholder for cards, tables, and statistics. |
| `PageHeader` | `src/components/app/PageHeader.tsx` | Standard view title, subtitle, breadcrumbs, and action button bar. |
| `FormField` | `src/components/ui/form-field.tsx` | Wrapper linking labels, inputs, descriptions, and errors via `aria-describedby`. |
| `Stepper` | `src/components/ui/stepper.tsx` | Multi-step progress tracker for onboarding wizards. |
| `SaveStatusIndicator` | `src/components/app/SaveStatusIndicator.tsx` | Unsaved, saving, saved, and error state indicator for auto-saving forms. |
| `DataTable` | `src/components/ui/data-table.tsx` | Sortable, paginated data table with loading, empty, and error states. |

---

## 5. Accessibility & Ergonomic Rules

- **Contrast Rule**: All body text must have at least **4.5:1** contrast ratio against its background. Large text (>= 18pt or bold 14pt) and UI components must have at least **3:1** contrast.
- **Primary Button Rule**: Button with background `#FF6A00` MUST have text color `#0B1F3B`.
- **Form Error Association**: Every input error message must have a unique `id` referenced by the input's `aria-describedby`.
- **Keyboard Navigation**: All interactive elements must have visible focus rings (`ring-2 ring-primary`) and be reachable via `Tab` / `Shift+Tab`.
- **Touch Targets**: Minimum 44x44px in standard mode, minimum 56x56px in Touch Mode.

---

## 6. Do's and Don'ts

| Do | Don't |
|---|---|
| Use Deep Navy `#0B1F3B` text on `#FF6A00` buttons. | Never use white text on `#FF6A00`. |
| Use Amber `#D97706` or Red `#DC2626` for warning/error status. | Never use orange for status badges or warnings. |
| Store access tokens in application memory only. | Never store JWT access tokens in `localStorage` or `sessionStorage`. |
| Format prices as INR currency using paise conversion. | Never perform price math or tax computation on the client. |
| Provide explicit empty states with actionable primary buttons. | Never show empty blank screens without guidance. |
