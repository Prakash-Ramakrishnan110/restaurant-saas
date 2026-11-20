# Stage A — Round 2 Review & Fixes

## Fixes Verified from Round 1 -> Round 2
All 22 defects documented in `docs/marketing/review/round1/defects.md` were fixed and verified in `round2/{hero-desktop,hero-phone,desktop-1440,mobile-390}.png`:
- Fixed `t=0` blank fade so frame 0 renders immediately at full opacity.
- Replaced Tea Shop scene with chai kettle, steel tumblers, Token 12 display, and zero `table` references.
- Fixed upward dosa toss, stove bar, ringing bell arcs, green check inside cashier printer, and mobile step rows.
- Verified `overflow=false` and `smallTaps=[]` across `360px`, `390px`, `768px`, and `1440px`.

## Remaining Polish Defects Found in Round 2 (Fixed for Round 3)
1. **Desktop step button wrap**: In `round2/desktop-1440.png` and `round2/hero-desktop.png`, `"2. Kitchen"` wrapped onto 2 lines inside the 5-column step button grid. Fixed by adding `whitespace-nowrap` and adjusting desktop step button font size to `text-[11px] sm:text-[12px]`.
2. **Mobile camera pan clipping on Pay/Sales**: In `round2/hero-phone.png` (`t = 10..15s`), `phoneCamShifts` `[0, -22, -16, -42, -45]` slightly clipped the right edge of the Cashier printer (`Pay`) and Owner phone (`Sales`). Fixed by adjusting `phoneCamShifts` to `[0, -24, -18, -46, -47.3]`.
3. **Mobile full-page screenshot timing**: `capture_stage_a.mjs` captured `mobile-390.png` mid-loop instead of seeking to `t=1` first. Fixed by calling `window.__scene.seek(1)` before capturing `mobile-390.png`.
