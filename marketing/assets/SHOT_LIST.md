# ServeMyFood Marketing Photo Shot List

Place real venue photos in `marketing/assets/photos/` using the exact filenames below (WebP or JPEG, landscape, minimum 1600px wide for hero, 1200px wide for cards). Never use stock photos or customer testimonials.

1. `hero-restaurant.webp` (or `.jpg`)
   - **Slot**: Full-width Hero background (100vh, navy 55% overlay behind headline & device frames).
   - **Subject**: Warm, real Indian cafe or restaurant dining room / counter during service, slightly wide shot with space on the left for text.

2. `venue-tea-shop.webp` (or `.jpg`)
   - **Slot**: Venues section — **Tea shop and bakery** card.
   - **Subject**: Real tea counter, boiler/samovar, glass/steel tumblers, snacks display (bun maska, samosa).

3. `venue-cafe-restaurant.webp` (or `.jpg`)
   - **Slot**: Venues section — **Cafe or restaurant** card.
   - **Subject**: Real dining tables with tiffin/dosa/coffee service and active kitchen pass.

4. `venue-hotel.webp` (or `.jpg`)
   - **Slot**: Venues section — **Hotel** card.
   - **Subject**: Real hotel dining hall or multi-area restaurant interior.

## Hardware Kit Photos (`marketing/assets/photos/hardware/`)

Place real owner-verified hardware kit photos inside `marketing/assets/photos/hardware/` before switching any kit in `marketing/content/hardware.ts` to `status: "READY"` and `ownerApproved: true`. The build fails if a `READY` kit is missing its photo, contents list, or `ownerApproved: true`.

1. `counter-kit.webp` — Counter phone/tablet, kitchen screen, and Token TV display.
2. `table-service-kit.webp` — Waiter phone, kitchen tablet, cashier screen, and printed QR cards.
3. `byod-kit.webp` — Existing shop phone, tablet, and laptop running ServeMyFood in a browser.
