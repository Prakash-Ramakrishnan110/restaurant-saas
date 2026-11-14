import QRCode from "qrcode";
import { evaluateBrandColor } from "./colorUtils";

export interface StandeeCardOptions {
  publicUrl: string;
  businessName: string;
  targetLabel: string;
  tableName?: string;
  tableNumber?: string;
  areaName?: string;
  targetType?: string;
  brandColor?: string;
  logoUrl?: string | null;
  language?: "EN" | "EN_TA";
  refCode?: string;
  cardWidth?: number;
  cardHeight?: number;
}

/**
 * Resolves explicit Table/Room Name and Table/Room Number for display on standees.
 */
export function resolveTableIdentity(options: {
  targetLabel: string;
  tableName?: string;
  tableNumber?: string;
  areaName?: string;
  targetType?: string;
}) {
  const type = (options.targetType || "TABLE").toUpperCase();
  const rawLabel = (options.targetLabel || "").trim();

  // 1. Table / Room Number resolution
  let numberStr = (options.tableNumber || "").trim();
  let numberHeading = "";
  let tamilHeading = "";

  if (type === "ROOM") {
    // Hotel Room
    const match = rawLabel.match(/^Room\s*([0-9A-Za-z_-]+)$/i) || rawLabel.match(/^([0-9]+)$/);
    const rNum = numberStr || (match ? match[1] : rawLabel);
    numberHeading = rNum.toUpperCase().startsWith("ROOM")
      ? rNum.toUpperCase()
      : `ROOM NO. ${rNum.toUpperCase()}`;
    tamilHeading = `அறை எண்: ${rNum}`;
  } else if (type === "COUNTER") {
    // Order Counter
    const match = rawLabel.match(/^Counter\s*([0-9A-Za-z_-]+)$/i) || rawLabel.match(/^([0-9]+)$/);
    const cNum = numberStr || (match ? match[1] : rawLabel);
    numberHeading = cNum.toUpperCase().startsWith("COUNTER")
      ? cNum.toUpperCase()
      : `COUNTER NO. ${cNum.toUpperCase()}`;
    tamilHeading = `கவுண்டர் எண்: ${cNum}`;
  } else {
    // Dining Table
    const matchT = rawLabel.match(/^T([0-9]+)$/i);
    const matchTable = rawLabel.match(/^Table\s*([0-9A-Za-z_-]+)$/i);
    const matchDigits = rawLabel.match(/^([0-9]+)$/);

    const tNum =
      numberStr ||
      (matchT ? matchT[1] : matchTable ? matchTable[1] : matchDigits ? matchDigits[1] : "");

    if (tNum) {
      numberHeading = `TABLE NO. ${tNum.toUpperCase()}`;
      tamilHeading = `மேஜை எண்: ${tNum}`;
    } else {
      numberHeading = rawLabel.toUpperCase().startsWith("TABLE")
        ? rawLabel.toUpperCase()
        : `TABLE: ${rawLabel.toUpperCase()}`;
      tamilHeading = `மேஜை: ${rawLabel}`;
    }
  }

  // 2. Table / Area Name resolution (many hotels/restaurants have custom named tables or sections)
  let nameStr = (options.tableName || options.areaName || "").trim();
  if (!nameStr) {
    nameStr =
      type === "ROOM" ? "Guest Rooms" : type === "COUNTER" ? "Counter Service" : "Main Dining";
  }

  return {
    numberHeading,
    tableName: nameStr,
    tamilHeading,
    type,
  };
}

/**
 * Loads an image from URL and resolves when loaded.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image from ${url}`));
    img.src = url;
  });
}

/**
 * Helper to draw rounded rectangle with custom radii.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | { tl: number; tr: number; br: number; bl: number }
) {
  const r =
    typeof radius === "number" ? { tl: radius, tr: radius, br: radius, bl: radius } : radius;
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
}

/**
 * Generates an HTML5 Canvas containing the high-resolution, print-ready branded Standee Card
 * with explicit Table Name and Table Number.
 */
export async function renderStandeeCardCanvas(
  options: StandeeCardOptions
): Promise<HTMLCanvasElement> {
  const width = options.cardWidth || 800;
  const height = options.cardHeight || 1200;
  const brandColor = options.brandColor || "#FF6A00";
  const businessName = options.businessName || "ServeMyFood Venue";
  const isBilingual = options.language === "EN_TA";

  // Resolve Table Name and Table Number
  const identity = resolveTableIdentity(options);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context");

  // 1. Crisp White Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // 2. Card Container Border with Rounded Corners
  ctx.save();
  roundRect(ctx, 14, 14, width - 28, height - 28, 28);
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.clip();

  // 3. Top Accent Brand Color Bar
  roundRect(ctx, 14, 14, width - 28, 32, { tl: 28, tr: 28, br: 0, bl: 0 });
  ctx.fillStyle = brandColor;
  ctx.fill();
  ctx.restore();

  // 4. Header: Logo or Monogram Badge
  let logoImg: HTMLImageElement | null = null;
  if (options.logoUrl) {
    try {
      logoImg = await loadImage(options.logoUrl);
    } catch {
      logoImg = null;
    }
  }

  const badgeY = 66;
  if (logoImg) {
    const logoBoxSize = 84;
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, badgeY + logoBoxSize / 2, logoBoxSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.06)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fill();
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.clip();

    const aspect = logoImg.width / logoImg.height;
    let drawW = logoBoxSize - 16;
    let drawH = (logoBoxSize - 16) / aspect;
    if (drawH > logoBoxSize - 16) {
      drawH = logoBoxSize - 16;
      drawW = drawH * aspect;
    }
    const drawX = (width - drawW) / 2;
    const drawY = badgeY + (logoBoxSize - drawH) / 2;
    ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else {
    const badgeSize = 76;
    const badgeX = (width - badgeSize) / 2;
    ctx.save();
    roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, 18);
    ctx.fillStyle = brandColor;
    ctx.shadowColor = "rgba(0,0,0,0.08)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fill();

    const initials =
      businessName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "SM";
    const contrastInfo = evaluateBrandColor(brandColor);
    ctx.fillStyle = contrastInfo.recommendedTextHex;
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, width / 2, badgeY + badgeSize / 2 + 1);
    ctx.restore();
  }

  // 5. Business / Restaurant Name
  ctx.save();
  ctx.fillStyle = "#0F172A";
  ctx.font = "900 27px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(businessName.toUpperCase(), width / 2, 184);

  // 6. Explicit Table / Area Name Pill Badge
  // Many hotels and restaurants name their tables or dining sections (e.g. Patio Open, Rooftop, Jasmine Cabana)
  const tableNameText = `TABLE NAME: ${identity.tableName.toUpperCase()}`;
  ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const nameWidth = ctx.measureText(tableNameText).width;
  const pillPadding = 28;
  const pillWidth = Math.min(width - 80, nameWidth + pillPadding);
  const pillHeight = 28;
  const pillX = (width - pillWidth) / 2;
  const pillY = 212;

  roundRect(ctx, pillX, pillY, pillWidth, pillHeight, 14);
  ctx.fillStyle = "#F1F5F9";
  ctx.fill();
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#475569";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tableNameText, width / 2, pillY + pillHeight / 2);

  // 7. Prominent Table / Room Number Heading
  // Explicitly mentions "TABLE NO. 30" or "ROOM NO. 101"
  const numberY = isBilingual ? 266 : 272;
  ctx.fillStyle = "#0F172A";
  ctx.font = "900 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(identity.numberHeading, width / 2, numberY);

  // Tamil subtitle below number if bilingual
  if (isBilingual) {
    ctx.fillStyle = "#64748B";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(identity.tamilHeading, width / 2, 298);
  }
  ctx.restore();

  // 8. QR Code Frame Container
  const qrFrameY = isBilingual ? 324 : 310;
  const qrFrameSize = 516;
  const qrFrameX = (width - qrFrameSize) / 2;

  ctx.save();
  roundRect(ctx, qrFrameX, qrFrameY, qrFrameSize, qrFrameSize, 24);
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(15, 23, 42, 0.06)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fill();
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 9. Render QR Code via offscreen canvas
  const qrSize = 450;
  const qrOffscreen = document.createElement("canvas");
  await QRCode.toCanvas(qrOffscreen, options.publicUrl, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: "H",
    color: {
      dark: "#0B1F3B",
      light: "#FFFFFF",
    },
  });

  const qrDrawX = (width - qrSize) / 2;
  const qrDrawY = qrFrameY + (qrFrameSize - qrSize) / 2;
  ctx.drawImage(qrOffscreen, qrDrawX, qrDrawY, qrSize, qrSize);

  // Center logo overlay inside QR code (<= 20% width)
  const centerLogoBackingSize = Math.floor(qrSize * 0.22);
  const centerLogoX = width / 2;
  const centerLogoY = qrDrawY + qrSize / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerLogoX, centerLogoY, centerLogoBackingSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(0,0,0,0.12)";
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();

  if (logoImg) {
    const innerSize = Math.floor(centerLogoBackingSize * 0.75);
    const aspect = logoImg.width / logoImg.height;
    let dW = innerSize;
    let dH = innerSize / aspect;
    if (dH > innerSize) {
      dH = innerSize;
      dW = dH * aspect;
    }
    ctx.drawImage(logoImg, centerLogoX - dW / 2, centerLogoY - dH / 2, dW, dH);
  } else {
    ctx.fillStyle = brandColor;
    ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(businessName[0]?.toUpperCase() || "S", centerLogoX, centerLogoY + 1);
  }
  ctx.restore();

  // 10. Call-To-Action (CTA) Wording
  const ctaBaseY = qrFrameY + qrFrameSize + 44;
  ctx.save();
  ctx.fillStyle = "#0F172A";
  ctx.font = "900 27px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Scan to see our menu", width / 2, ctaBaseY);

  if (isBilingual) {
    ctx.fillStyle = "#475569";
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("மெனுவை பார்க்க ஸ்கேன் செய்யவும்", width / 2, ctaBaseY + 34);

    ctx.fillStyle = "#64748B";
    ctx.font = "500 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Point your phone camera to browse & order", width / 2, ctaBaseY + 68);
  } else {
    ctx.fillStyle = "#64748B";
    ctx.font = "500 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Point your phone camera to browse & order", width / 2, ctaBaseY + 36);
  }
  ctx.restore();

  // 11. Footer Section
  ctx.save();
  const dividerY = height - 72;
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, dividerY);
  ctx.lineTo(width - 60, dividerY);
  ctx.stroke();

  const refLabel = `${identity.numberHeading} (${identity.tableName})`;
  ctx.fillStyle = "#94A3B8";
  ctx.font = "500 12px 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`ServeMyFood Standee • Ref #${refLabel}`, 60, height - 38);

  ctx.fillStyle = "#94A3B8";
  ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("Powered by ServeMyFood", width - 60, height - 38);
  ctx.restore();

  return canvas;
}

/**
 * Downloads the branded standee card as a high-resolution PNG file.
 */
export async function downloadStandeeCardPNG(
  options: StandeeCardOptions,
  filename?: string
): Promise<void> {
  const canvas = await renderStandeeCardCanvas(options);
  const identity = resolveTableIdentity(options);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (filename || `standee-${identity.numberHeading}-${identity.tableName}`)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .toLowerCase();
      link.href = url;
      link.download = `${safeName}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

/**
 * Downloads a standalone branded Standee Card in SVG format.
 */
export async function downloadStandeeCardSVG(
  options: StandeeCardOptions,
  filename?: string
): Promise<void> {
  const width = options.cardWidth || 800;
  const height = options.cardHeight || 1200;
  const brandColor = options.brandColor || "#FF6A00";
  const businessName = options.businessName || "ServeMyFood Venue";
  const isBilingual = options.language === "EN_TA";

  const identity = resolveTableIdentity(options);

  // Generate QR data URL
  const qrDataUrl = await QRCode.toDataURL(options.publicUrl, {
    width: 450,
    margin: 1,
    errorCorrectionLevel: "H",
    color: {
      dark: "#0B1F3B",
      light: "#FFFFFF",
    },
  });

  const tableNameText = `TABLE NAME: ${identity.tableName.toUpperCase()}`;

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 900; fill: #0F172A; text-anchor: middle; }
      .name-txt { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: bold; fill: #475569; text-anchor: middle; }
      .number-txt { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 900; fill: #0F172A; text-anchor: middle; }
      .tamil { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: bold; fill: #64748B; text-anchor: middle; }
      .cta { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 900; fill: #0F172A; text-anchor: middle; }
      .cta-sub { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 500; fill: #64748B; text-anchor: middle; }
      .foot { font-family: monospace; font-size: 12px; fill: #94A3B8; }
    </style>
  </defs>

  <!-- Background and Border -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="#FFFFFF" />
  <rect x="14" y="14" width="${width - 28}" height="${height - 28}" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3" />
  
  <!-- Top Brand Accent Bar -->
  <path d="M 14 42 A 28 28 0 0 1 42 14 L ${width - 42} 14 A 28 28 0 0 1 ${width - 14} 42 L ${width - 14} 46 L 14 46 Z" fill="${brandColor}" />

  <!-- Business Name -->
  <text x="${width / 2}" y="184" class="title" font-size="27">${escapeXml(businessName.toUpperCase())}</text>

  <!-- Table Name Badge -->
  <rect x="${width / 2 - 170}" y="212" width="340" height="28" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1" />
  <text x="${width / 2}" y="231" class="name-txt" font-size="13">${escapeXml(tableNameText)}</text>

  <!-- Table Number Heading -->
  <text x="${width / 2}" y="${isBilingual ? 266 : 272}" class="number-txt" font-size="32">${escapeXml(identity.numberHeading)}</text>
  ${isBilingual ? `<text x="${width / 2}" y="298" class="tamil" font-size="15">${escapeXml(identity.tamilHeading)}</text>` : ""}

  <!-- QR Frame -->
  <rect x="142" y="${isBilingual ? 324 : 310}" width="516" height="516" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" />
  <image x="175" y="${isBilingual ? 357 : 343}" width="450" height="450" href="${qrDataUrl}" />

  <!-- CTA -->
  <text x="${width / 2}" y="${isBilingual ? 884 : 870}" class="cta" font-size="27">Scan to see our menu</text>
  ${isBilingual ? `<text x="${width / 2}" y="918" class="tamil" font-size="18">மெனுவை பார்க்க ஸ்கேன் செய்யவும்</text>` : ""}
  <text x="${width / 2}" y="${isBilingual ? 952 : 906}" class="cta-sub" font-size="16">Point your phone camera to browse &amp; order</text>

  <!-- Footer -->
  <line x1="60" y1="${height - 72}" x2="${width - 60}" y2="${height - 72}" stroke="#E2E8F0" stroke-width="1.5" />
  <text x="60" y="${height - 38}" class="foot">ServeMyFood Standee • Ref #${escapeXml(identity.numberHeading)} (${escapeXml(identity.tableName)})</text>
  <text x="${width - 60}" y="${height - 38}" class="foot" text-anchor="end">Powered by ServeMyFood</text>
</svg>`;

  const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = (filename || `standee-${identity.numberHeading}-${identity.tableName}`)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase();
  link.href = url;
  link.download = `${safeName}.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}
