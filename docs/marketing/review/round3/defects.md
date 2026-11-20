# Stage A — Round 3 Review

## Verified Fixes from Round 2 -> Round 3
1. **Desktop step button single-line fit**: Verified in `round3/desktop-1440.png` and `round3/hero-desktop.png` that all 5 step buttons (`1. Order`, `2. Kitchen`, `3. Serve`, `4. Pay`, `5. Sales`) sit on a single line without wrapping.
2. **Mobile full-page screenshot state**: Verified in `round3/mobile-390.png` that the mobile hero starts cleanly on Step 1 (`1. Order`) with the `Book a free demo` and `See how it works` buttons, step controls, and business tabs all cleanly aligned.
3. **Layout & Tap Targets**: Verified `overflow=false` and `smallTaps=[]` across `360px`, `390px`, `768px`, and `1440px`.

## Performance & Media Captures
- 4x CPU-throttled 30s trace (`docs/marketing/review/perf.txt`): `Average FPS: 45.6`, `Longest Task (ms): 71`.
- 20s screen recording: `docs/marketing/review/hero.webm`.
- Note for Stage B / follow-up polish: In `round3/hero-phone.png` (`t = 12..15s`, `5. Sales`), the Owner phone at the far right of the `190%` mobile pan canvas is partially clipped at the right edge of `390px`; adjusting the mobile camera pan or repositioning the Owner phone slightly inward in Stage B will center it completely on `390px`.
