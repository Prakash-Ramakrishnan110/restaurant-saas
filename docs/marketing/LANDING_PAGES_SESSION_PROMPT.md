# LANDING PAGES SESSION — Prompt

Build a public marketing site for ServeMyFood. Do NOT change the app.

## RULES
- Truth first. The site may show as working ONLY what works today in the app. Check `docs/audit/DELTA.md`, `docs/audit/register-coverage.md` and the running demo. Everything else is labelled Coming soon or left out.
- Never write or show: tax or GST invoices, customer QR ordering as live, online payments as live, inventory as live, Swiggy or Zomato links, offline mode, hotel front-office links, AI claims, customer counts, testimonials, awards, partner logos, star ratings, the words bank-grade or 100% uptime, or any price the owner has not supplied. No stock photos. Use drawn illustrations and real screenshots of the app only.
- Orange (`#FF6A00`) buttons use NAVY text. White text on orange is forbidden. Fonts: Poppins (headings), Inter (body), Noto Sans Tamil, self-hosted.
- No third-party scripts, no cookies, no trackers. English and Tamil on every page. Plain words, no jargon.
- Do not answer questions meant for the product owner. Do not git push. Never move or delete tags. Show diffs, not descriptions. After any interruption run `git status` and `git diff --stat`.

## STRUCTURE
- New top-level folder `marketing/` (Vite + React + TypeScript + Tailwind, same design tokens as the app). Build output is static HTML: fetching a page with no JavaScript must already contain its H1 and main text (prerender at build time). Language by path: `/` (English) and `/ta/` (Tamil), with hreflang and a language toggle that keeps the page.
- Pages: Home; Tea shops and bakeries; Restaurants and cafes; Hotels; Book a demo; Privacy; Terms; 404.
- Config files the owner edits: `marketing/content/site.ts` (company name Fusion Engine Technology, `APP_URL`, WhatsApp number, contact email, address), `marketing/content/pricing.ts` (default mode: contact us; no numbers), `marketing/content/claims.ts` (each claim has status `LIVE` or `SOON`). No contact details or prices are hard-coded in components. Missing values show a visible TODO in dev and FAIL the production build.

## HOME PAGE SECTIONS (in this order)
1. Header: logo, language toggle, Login (links to `APP_URL`), Book a demo button.
2. Hero: H1, subhead, two buttons, and the animated story on the right (stacked below on phones).
3. How it works: 5 captioned steps that mirror the animation.
4. Built for your business: cards for Tea shop, Bakery, Cafe, Restaurant, Fine dining, Hotel restaurant, Food court, each linking to its venue page, each saying what the venue gets in one line.
5. Problems we solve (owner words, only LIVE items): wrong orders and lost paper slips, dishes that are finished, not knowing what happened today, new staff who need training, staff who should see only their own work.
6. Features: only LIVE ones as normal cards (orders to the kitchen with a sound alert, menu with photos and Tamil names, one-tap sold-out switch, table and counter service, QR codes for tables, staff roles with separate logins, branches, English and Tamil). SOON items in a separate muted group with a Coming soon tag (customer QR ordering and tracking, online payments, inventory, shifts and attendance).
7. Trust, honest version: each restaurant's data is kept separate; staff see only what their role allows; sign-in is protected; changes are recorded. Mention only what the app proves. If a statement is not proven by a test, leave it out.
8. Video section: poster, play button, captions, transcript.
9. Pricing: one calm block, "Simple yearly plans. Talk to us about pilot pricing." Show numbers only if `pricing.ts` has them.
10. FAQ (6 to 8 plain questions: devices, internet, printers, Tamil, how long to start, is my data safe, what is not ready yet). Say clearly that tax invoices are not ready yet and that demo receipts are labelled.
11. Book a demo band, then footer (company, address, Privacy, Terms, language).

## VENUE PAGES
Same components with their own H1, steps and animation variant.
- Tea shops and bakeries: counter, token and cash flow, no word `table` anywhere in English or Tamil.
- Restaurants and cafes: table, kitchen, serve, bill.
- Hotels: restaurant flow plus a note that room service and room charges are Coming soon.

## COPY DECK (use exactly; the owner will have a native Tamil speaker review)
- **H1 EN:** Take orders. Run the kitchen. Get paid. See today's sales.
- **H1 TA:** ஆர்டர் எடுங்கள். சமையலறையை இயக்குங்கள். பணம் பெறுங்கள். இன்றைய விற்பனையைப் பாருங்கள்.
- **Sub EN:** One simple system for tea shops, cafes, restaurants and hotels. Works on a phone, tablet or computer. In Tamil and English.
- **Sub TA:** தேநீர்க் கடை, கஃபே, உணவகம், ஹோட்டல் அனைத்திற்கும் ஒரே எளிய அமைப்பு. போன், டேப்லெட் அல்லது கணினியில் இயங்கும். தமிழ் மற்றும் ஆங்கிலத்தில்.
- **Buttons EN:** Book a free demo | Watch the 60-second demo
- **Buttons TA:** இலவச டெமோ பதிவு செய்யுங்கள் | 60 வினாடி டெமோவைப் பாருங்கள்
- **Steps EN:** 1 Waiter takes the order on a phone. 2 Kitchen sees it at once, with a sound alert. 3 Waiter serves when it is ready. 4 Cashier takes payment and gives the receipt. 5 Owner sees today's sales.
- **Steps TA:** 1 பணியாளர் போனில் ஆர்டர் எடுக்கிறார். 2 சமையலறைக்கு உடனே தெரியும், ஒலி அறிவிப்புடன். 3 தயாரானதும் பணியாளர் பரிமாறுகிறார். 4 கேஷியர் பணம் பெற்று ரசீது தருகிறார். 5 உரிமையாளர் இன்றைய விற்பனையைப் பார்க்கிறார்.
- **Counter story EN:** Customer pays, gets a token, and collects when it is called.
- **Counter story TA:** வாடிக்கையாளர் பணம் செலுத்தி டோக்கன் பெற்று, அழைக்கும்போது பெற்றுக்கொள்கிறார்.
- Write the remaining copy in the same plain style in both languages, short sentences, no jargon (never: tenant, entitlement, paise, preset, flag, platform, ecosystem, solution).

## HERO ANIMATION (coded, not a video file)
- A 12 second loop in SVG, CSS and the Web Animations API, built from simplified drawn screens (waiter phone, kitchen screen, cashier screen, owner phone) that match the real product look. Label it Sample data in a corner. Sample numbers only; no tax lines.
- Restaurant story: waiter taps Table 4, adds 2 Masala Dosa and 2 Filter Coffee, taps Send; kitchen ticket slides in with a chime icon; cook taps Ready; waiter phone shows Ready and Served; cashier shows the total and Cash paid; owner phone shows today's sales rising. A progress bar and the five step captions highlight in sync.
- Counter story: tap 2 Chai and 1 Samosa, tap UPI or Cash, token 12 appears, Ready, token 12 disappears.
- The venue switch (Tea shop, Restaurant, Hotel) swaps the story. Controls: pause and play button, steps are clickable.
- `prefers-reduced-motion`: no motion; show the five steps as a static storyboard with the same captions. The animation pauses when off screen and when the tab is hidden. No layout shift.
- Initial JavaScript for the home page is 150 KB gzip or less, with animation code lazy loaded after first paint.

## REAL DEMO VIDEO (recorded by a script, from the real app)
1. Add `scripts/marketing/record_demo.ps1` and a Playwright script. It runs against the Docker stack seeded with `seed_demo` (demo data only, no real customers), Chromium 1280x720 with a visible click highlight and an on-screen step caption.
2. Sign in OFF camera (storage state) so no login page or demo credentials appear. Never film the Demo Test Accounts panel.
3. Restaurant video (60 to 90 seconds): waiter order, kitchen alert and Ready, served, cashier payment and receipt (shows DEMO RECEIPT), owner dashboard. Tea shop video (about 30 seconds): counter order, token, ready, collected, sales.
4. Convert with ffmpeg to MP4 (H.264) and WebM, each 8 MB or less for the long video and 4 MB for the short one, plus a poster image. If ffmpeg is missing, STOP and tell the owner to run: `winget install Gyan.FFmpeg`. Do not skip MP4 (iPhones need it).
5. Write English and Tamil captions (`.vtt`) and a transcript. The video is silent. No autoplay: load it only when the visitor presses play (`preload none`, poster shown). Provide a download-free embed: no YouTube or external hosts.
6. Save the final files in `marketing/public/video/` and keep the recording scripts in git. Anything on screen must match the running product on the day of recording.

## BOOK A DEMO (backend + form)
- `POST /api/v1/public/leads/` (`AllowAny`, JSON). Fields: `name`, `phone` (Indian mobile, 10 digits), `business type` (the 7 types), `city`, optional `message`, `language`, `consent` (required). Honeypot field, throttling per IP and per phone, Origin check against the marketing domain, no personal data in logs, response never reveals whether a phone was seen before.
- Lead model in the platform area, tenant-free. Platform admins get a Leads page in the platform console (`new`, `contacted`, `closed`, with notes) and a platform sidebar entry; update `docs/product/sidebar-map.md`. Restaurant users get 403 or 404 on leads. Audit status changes.
- Form: inline errors, clear success message, no page reload. The consent text links to Privacy. Also a WhatsApp button (`wa.me` link from `site.ts` with a prefilled message) and a phone link.
- Tests: valid lead stored; invalid phone; missing consent; honeypot rejected; rate limit; isolation and role matrix; platform admin can list; restaurant roles cannot; no phone number in logs.

## SEO, PRIVACY, SPEED
- Unique title and description per page and language, canonical, hreflang, Open Graph image (drawn, not a stock photo), `sitemap.xml`, `robots.txt`, structured data for Organization and SoftwareApplication with NO ratings or reviews.
- Privacy and Terms pages written in plain language from the real data flow (what the form stores, why, how long, how to ask for deletion), marked at the top in dev as `DRAFT FOR LAWYER REVIEW`. Production build fails until that marker is removed by the owner.
- Targets on a throttled mobile profile: Lighthouse performance 90 or more, accessibility 95 or more, SEO 95 or more, CLS under 0.1, LCP under 2.5 s. Page weight budget (without the video) 400 KB. Save the Lighthouse reports to `docs/evidence/marketing/`.

## TESTS (fail the build, do not weaken)
- HTML without JavaScript contains the H1 and key text in English and Tamil on every page.
- Forbidden-claims scan of the built HTML in both languages: fails on `tax`, `GST`, `Swiggy`, `Zomato`, `offline`, `bank-grade`, `100%`, `trusted by`, `AI`, and on any feature from `claims.ts` marked `SOON` that appears without its Coming soon tag. Fails on the words `tenant`, `entitlement`, `paise`, `preset`, `flag`.
- The word `table` never appears on the Tea shop page in English or Tamil.
- axe: zero serious violations on every page. Keyboard test: every control reachable, visible focus, animation pause control works.
- Reduced-motion test shows the static storyboard. The video element has poster, captions track, `preload none`, no autoplay and no sound.
- 360 px, 768 px and 1440 px: no horizontal scrolling and no clipped text, English and Tamil.
- Link check (no broken links), images have alt text, no console errors, no requests to third-party hosts.
- Form tests (above). Playwright against the built site.

## DELIVERY
- `scripts/marketing/verify.ps1` runs every marketing gate once and writes `docs/evidence/marketing/SUMMARY.txt` generated from the raw outputs (any failure says FAIL; never soften numbers).
- Screenshots in `docs/evidence/marketing/shots/`: home, each venue page, book a demo, in English and Tamil, at 360 and 1440 px, plus two frames from each video.
- Add `docs/marketing/README.md`: how to edit copy, claims and pricing; how to rebuild the videos; how to deploy as static files; the list of items the owner must supply.
- Commit in small commits. Tag `v1.0.0-landing` only if every marketing gate and the existing app gates in `verify_all.ps1` pass.

## FINAL REPORT (one page, no pasted output)
1. Table of every part with PASS or FAIL and the evidence file.
2. Claims table: each claim, LIVE or SOON, where it appears.
3. What the owner must supply or review: contact details, domain, real logo, Tamil review, lawyer review of Privacy and Terms, pricing decision.
4. Open questions for the product owner, unchanged: first pilot venue, accountant and tax setup, devices and printer model, payment gateway account.

