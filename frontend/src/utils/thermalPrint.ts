import { formatRupees } from "./currency";

export type ThermalPaperWidth = "80" | "58";
export type ThermalPrintMode = "BROWSER" | "LOCAL_BRIDGE";
export type ThermalSlipType = "BILL" | "KOT" | "TOKEN" | "Z_REPORT" | "REFUND";

export interface ThermalPrinterConfig {
  printerName: string;
  ipAddress: string;
  port: string;
  paperWidth: ThermalPaperWidth;
  printMode: ThermalPrintMode;
  autoPrintKOT: boolean;
  autoPrintBill: boolean;
  kickDrawer: boolean;
}

export function getThermalPrinterConfig(): ThermalPrinterConfig {
  return {
    printerName: localStorage.getItem("smf_printer_name") || "Counter Thermal 80mm",
    ipAddress: localStorage.getItem("smf_printer_ip") || "127.0.0.1",
    port: localStorage.getItem("smf_printer_port") || "9100",
    paperWidth: (localStorage.getItem("smf_printer_width") as ThermalPaperWidth) || "80",
    printMode: (localStorage.getItem("smf_printer_mode") as ThermalPrintMode) || "BROWSER",
    autoPrintKOT: localStorage.getItem("smf_autoprint_kot") === "true",
    autoPrintBill: localStorage.getItem("smf_autoprint_bill") !== "false",
    kickDrawer: localStorage.getItem("smf_kick_drawer") === "true",
  };
}

export async function dispatchThermalPrint(payload: {
  slipType: ThermalSlipType;
  title: string;
  lines: Array<{ left: string; right?: string; bold?: boolean }>;
  footer?: string[];
}): Promise<{ method: "LOCAL_BRIDGE" | "BROWSER"; fallbackUsed: boolean }> {
  const cfg = getThermalPrinterConfig();

  if (cfg.printMode === "LOCAL_BRIDGE") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const res = await fetch(`http://${cfg.ipAddress}:${cfg.port}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printer: cfg.printerName,
          paper_width_mm: Number(cfg.paperWidth),
          kick_drawer: cfg.kickDrawer && payload.slipType === "BILL",
          ...payload,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        return { method: "LOCAL_BRIDGE", fallbackUsed: false };
      }
    } catch {
      clearTimeout(timer);
    }
    if (typeof window !== "undefined" && typeof window.print === "function") {
      window.print();
    }
    return { method: "BROWSER", fallbackUsed: true };
  }

  if (typeof window !== "undefined" && typeof window.print === "function") {
    window.print();
  }
  return { method: "BROWSER", fallbackUsed: false };
}

export function computeEqualSplitShares(
  totalPaise: number,
  shares: number
): Array<{ share_index: number; label: string; amount_paise: number; formatted: string }> {
  const count = Math.max(2, Math.min(20, Math.trunc(shares)));
  const base = Math.floor(totalPaise / count);
  const rem = totalPaise - base * count;
  return Array.from({ length: count }, (_, idx) => {
    const amt = base + (idx === 0 ? rem : 0);
    return {
      share_index: idx + 1,
      label: `Share ${idx + 1} of ${count}`,
      amount_paise: amt,
      formatted: formatRupees(amt),
    };
  });
}
