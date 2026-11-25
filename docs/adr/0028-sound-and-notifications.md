# ADR 0028: Sound Engine, Spoken Notifications, and Privacy Guardrails

## Status
Accepted (Stage 3, `v1.8.0-sound`)

## Decision
ServeMyFood uses a single modular browser sound engine (`frontend/src/sound/`) backed by pre-generated original chimes (`frontend/public/sound/*.wav`), SpeechSynthesis with EN/TA voice detection, optional pre-recorded voice clips (`public/sound/voice/<lang>/`), and a role-filtered per-branch backend event feed (`GET /api/v1/events/?since=<seq>`).

### Spoken Content Privacy Rule (Mandatory)
- **MAY be spoken aloud:** target identifiers (`Table 4`, `Token 12`), **dish names**, and **quantities** (up to 3 dishes in live announcements, e.g., `"New order. T4. 2 dosa, 1 idly and 3 more"`, or translated `name_ta` ONLY when a Tamil system voice is detected).
- **NEVER spoken aloud:** customer names, order/item notes, phone numbers, staff names, prices, totals, or tax terms.
- All announcements are hard-capped to 12 seconds max, queued (max 5 items, prioritized), deduplicated by `event_id`, and burst-coalesced (`>3` events in 5s -> summary such as `"3 new orders"`).

### Device vs Branch Preferences
- **Device preferences** (`localStorage`: sound enabled/muted, volume, speed, voice language, wake lock, per-event overrides) stay strictly on the device (zero auth tokens).
- **Branch defaults** (`BranchCapabilities.sound_defaults`) are saved on the server by `OWNER` and `BRANCH_MANAGER` and audited in `AuditLog`.

### Visual Fallback & Disconnect Safety
- Every sound event is always paired with a visual notification.
- If sound has not been activated within 60 seconds on Kitchen, Waiter, Cashier, or Token TV screens, a persistent red banner warns: `"Sound is off. Orders will not be heard."` with a single-tap Start Sound button.
- Connection loss triggers a short low double tone and a persistent disconnect banner.
