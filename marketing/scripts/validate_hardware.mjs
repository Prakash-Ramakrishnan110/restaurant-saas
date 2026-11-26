import fs from "node:fs";
import path from "node:path";

/**
 * Validates hardware kit rules at build time:
 * - Any kit with status === "READY" MUST have ownerApproved === true,
 *   a non-empty photo file existing inside marketing/assets/photos/hardware/,
 *   and non-empty contentsEn / contentsTa lists.
 * - Rejects external URLs or path traversal in kit.photo.
 */
export function validateHardwareKits(kits, hardwarePhotosDir) {
  const errors = [];
  if (!Array.isArray(kits) || kits.length === 0) {
    errors.push("HARDWARE_KITS must define at least one hardware kit.");
    return errors;
  }

  for (const kit of kits) {
    if (kit.status !== "READY") continue;

    if (kit.ownerApproved !== true) {
      errors.push(`READY hardware kit "${kit.id}" is missing owner approval (ownerApproved: true).`);
    }

    const photo = typeof kit.photo === "string" ? kit.photo.trim() : "";
    if (!photo) {
      errors.push(`READY hardware kit "${kit.id}" is missing a photo filename.`);
    } else if (
      photo.includes("..") ||
      photo.includes("/") ||
      photo.includes("\\") ||
      /^https?:/i.test(photo)
    ) {
      errors.push(
        `READY hardware kit "${kit.id}" photo "${photo}" must be a local filename inside marketing/assets/photos/hardware/.`
      );
    } else {
      const fullPhotoPath = path.join(hardwarePhotosDir, photo);
      if (!fs.existsSync(fullPhotoPath)) {
        errors.push(
          `READY hardware kit "${kit.id}" photo not found at marketing/assets/photos/hardware/${photo}.`
        );
      }
    }

    if (!Array.isArray(kit.contentsEn) || kit.contentsEn.filter(Boolean).length === 0) {
      errors.push(`READY hardware kit "${kit.id}" is missing contentsEn items.`);
    }
    if (!Array.isArray(kit.contentsTa) || kit.contentsTa.filter(Boolean).length === 0) {
      errors.push(`READY hardware kit "${kit.id}" is missing contentsTa items.`);
    }
  }

  return errors;
}

export function parseHardwareKitsFromTs(tsSource) {
  const arrayMatch = tsSource.match(/export const HARDWARE_KITS:\s*HardwareKit\[\]\s*=\s*(\[[\s\S]*?\n\]);/);
  if (!arrayMatch) {
    throw new Error("Could not locate HARDWARE_KITS array in marketing/content/hardware.ts");
  }
  const fn = new Function(`return (${arrayMatch[1]});`);
  return fn();
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const rootDir = path.resolve(import.meta.dirname, "..");
  const tsPath = path.join(rootDir, "content/hardware.ts");
  const photosDir = path.join(rootDir, "assets/photos/hardware");
  const kits = parseHardwareKitsFromTs(fs.readFileSync(tsPath, "utf-8"));
  const errs = validateHardwareKits(kits, photosDir);
  if (errs.length > 0) {
    console.error("HARDWARE VALIDATION FAILED:\n- " + errs.join("\n- "));
    process.exit(1);
  }
  console.log(`PASS: Hardware config validated (${kits.length} kits, ${kits.filter((k) => k.status === "READY").length} READY).`);
}
