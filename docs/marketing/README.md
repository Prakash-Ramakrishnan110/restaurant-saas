# ServeMyFood Marketing Site (`marketing/`)

Static, prerendered bilingual (English `/` and Tamil `/ta/`) marketing site for ServeMyFood by Fusion Engine Technology.

## 1. Owner Content & Legal Checklist (Required Before Production Build)
`npm run build` **intentionally fails** until all `TODO:` placeholders and legal draft markers are replaced:
1. **`marketing/content/site.ts`**: Fill in `siteUrl`, `whatsappNumber`, `contactPhone`, `contactEmail`, `address`, and production `appUrl` / `apiBaseUrl`.
2. **`marketing/src/pages/LegalPage.tsx`**: Have a lawyer review the Privacy Notice & Terms of Use, then remove the `DRAFT FOR LAWYER REVIEW` banner.
3. **`marketing/content/pricing.ts`**: Default mode is `"contact"` (`Simple yearly plans. Talk to us about pilot pricing.`). To list prices, switch `mode` to `"listed"` and populate `plans`.
4. **`marketing/content/claims.ts`**: Only mark features `"LIVE"` when they are live and verified in the app; keep unshipped features `"SOON"`.
5. **Tamil Copy Review**: Have a native Tamil speaker review `marketing/src/copy.ts` and `marketing/content/claims.ts`.

## 2. Commands
```powershell
cd marketing
npm install
npm run dev          # Local dev server on http://localhost:5174
npm run typecheck
npm run build        # Strict production build (blocks on TODO/DRAFT)
```
For local CI preview verification while `TODO`/`DRAFT` markers are still present:
```powershell
$env:MARKETING_ALLOW_DRAFT="1"
npm run build
```

## 3. Recording the Demo Videos (Requires `ffmpeg`)
1. Install `ffmpeg` if not installed: `winget install Gyan.FFmpeg`
2. Seed demo data in Docker (`seed_demo`) and run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/marketing/record_demo.ps1
   ```
   Outputs go to `marketing/public/video/` (`restaurant-demo.mp4/.webm` <= 8 MB, `teashop-demo.mp4/.webm` <= 4 MB).

## 4. Verification
```powershell
powershell -ExecutionPolicy Bypass -File scripts/marketing/verify.ps1
```
Writes `docs/evidence/marketing/SUMMARY.txt`, screenshots in `docs/evidence/marketing/shots/`, and Lighthouse reports in `docs/evidence/marketing/`.

## 5. Static Deployment
Deploy `marketing/dist/` to any static host (Nginx, Cloudflare Pages, S3 + CloudFront, Netlify) with `404.html` configured as the not-found page. Set `MARKETING_ALLOWED_ORIGINS` in the backend `.env` to match your deployed domain so `POST /api/v1/public/leads/` accepts form submissions.
