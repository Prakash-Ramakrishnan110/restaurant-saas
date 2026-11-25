# ServeMyFood Voice Clip Recording Guide (`public/sound/voice/<lang>/`)

Optional human-recorded clips upgrade browser `speechSynthesis` with crisp studio voice playback. When clips are missing for a phrase or number, the sound engine falls back automatically to `speechSynthesis`, then chime-only.

## Directory Structure
- `frontend/public/sound/voice/en/` — English clips (`en-IN` neutral accent)
- `frontend/public/sound/voice/ta/` — Tamil clips (`ta-IN` clear colloquial kitchen/counter style)

## Required Clips per Language
1. **Numbers `0` through `999`** (or modular chunks: `0.mp3`..`999.mp3` / `100.mp3`..`900.mp3` + `0`..`99`):
   - Filename format: `<lang>/<number>.wav` or `.mp3` (e.g. `en/12.wav`, `ta/12.wav`).
2. **Fixed Phrase Clips:**
   - `new-order.wav` — *"New order"* / *"புதிய ஆர்டர்"*
   - `table.wav` — *"Table"* / *"மேஜை"*
   - `token.wav` — *"Token"* / *"டோக்கன்"*
   - `ready.wav` — *"ready"* / *"தயார்"*
   - `needs-approval.wav` — *"Order needs approval"* / *"ஆர்டர் அனுமதி தேவை"*
   - `waiting-payment.wav` — *"Waiting for payment"* / *"கட்டணம் செலுத்த காத்திருக்கிறது"*
   - `needs-water.wav` — *"needs water"* / *"தண்ணீர் தேவை"*
   - `needs-bill.wav` — *"needs bill"* / *"பில் தேவை"*
   - `needs-waiter.wav` — *"needs waiter"* / *"பணியாளர் தேவை"*
   - `needs-cutlery.wav` — *"needs cutlery"* / *"கரண்டி முட்கரண்டி தேவை"*
   - `and-more.wav` — *"more items"* / *"மேலும் உணவுகள்"*

## Technical Constraints
- Mono 22,050 Hz, 16-bit PCM WAV or 64 kbps MP3, peak normalized to `-3 dBFS`.
- Maximum clip length: `1.2 s` per chime, `< 12 s` total combined sequence.
- **Privacy check:** Never pre-record customer names, prices, or notes.
