import React, { useState } from "react";
import { Printer, Wifi, CheckCircle2, Eye, Save, Volume2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { formatRupees } from "../../utils/currency";
import { dispatchThermalPrint, ThermalPrintMode, ThermalSlipType } from "../../utils/thermalPrint";
import { playOrderAlert } from "../../utils/soundAlerts";

export const DeviceSettingsPage: React.FC = () => {
  const [printerName, setPrinterName] = useState(() => {
    return localStorage.getItem("smf_printer_name") || "Counter Thermal 80mm";
  });
  const [ipAddress, setIpAddress] = useState(() => {
    return localStorage.getItem("smf_printer_ip") || "192.168.1.100";
  });
  const [port, setPort] = useState(() => {
    return localStorage.getItem("smf_printer_port") || "9100";
  });
  const [paperWidth, setPaperWidth] = useState<"58" | "80">(() => {
    return (localStorage.getItem("smf_printer_width") as "58" | "80") || "80";
  });
  const [printMode, setPrintMode] = useState<ThermalPrintMode>(() => {
    return (localStorage.getItem("smf_printer_mode") as ThermalPrintMode) || "BROWSER";
  });
  const [previewSlipType, setPreviewSlipType] = useState<ThermalSlipType>("BILL");
  const [autoPrintKOT, setAutoPrintKOT] = useState(() => {
    return localStorage.getItem("smf_autoprint_kot") === "true";
  });
  const [autoPrintBill, setAutoPrintBill] = useState(() => {
    return localStorage.getItem("smf_autoprint_bill") !== "false";
  });
  const [kickDrawer, setKickDrawer] = useState(() => {
    return localStorage.getItem("smf_kick_drawer") === "true";
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testPrintNotice, setTestPrintNotice] = useState<string | null>(null);
  const [showTestSlip, setShowTestSlip] = useState(false);

  const handleSave = () => {
    localStorage.setItem("smf_printer_name", printerName);
    localStorage.setItem("smf_printer_ip", ipAddress);
    localStorage.setItem("smf_printer_port", port);
    localStorage.setItem("smf_printer_width", paperWidth);
    localStorage.setItem("smf_printer_mode", printMode);
    localStorage.setItem("smf_autoprint_kot", String(autoPrintKOT));
    localStorage.setItem("smf_autoprint_bill", String(autoPrintBill));
    localStorage.setItem("smf_kick_drawer", String(kickDrawer));

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleTestPrint = async () => {
    const res = await dispatchThermalPrint({
      slipType: previewSlipType,
      title: `TEST ${previewSlipType} (${paperWidth}mm)`,
      lines: [
        { left: "2x Filter Coffee", right: formatRupees(9000) },
        { left: "1x Masala Dosa", right: formatRupees(8500) },
      ],
    });
    setTestPrintNotice(
      res.fallbackUsed
        ? "Local ESC/POS bridge unreachable — fell back to browser print dialog."
        : `Test ${previewSlipType} slip dispatched via ${res.method}.`
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Printer className="w-6 h-6 text-primary" />
          Printers & Devices{" "}
          <span className="text-xs text-muted-foreground font-normal">பிரிண்டர் அமைப்புகள்</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure network ESC/POS thermal receipt and kitchen order ticket (KOT) printers.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded-lg text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Printer configuration saved successfully!
        </div>
      )}

      {testPrintNotice && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold">
          {testPrintNotice}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Main Thermal Connection Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Wifi className="w-4 h-4 text-primary" />
                Network Thermal ESC/POS Printer
              </CardTitle>
              <CardDescription className="text-xs">
                Supports all standard Ethernet/Wi-Fi POS printers (Epson, TVS, NGX, Star, Hoin) and
                zero-driver browser printing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Printer Device Label
                  </label>
                  <input
                    type="text"
                    value={printerName}
                    onChange={(e) => setPrinterName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary"
                    placeholder="e.g. Counter Billing Printer"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Print Dispatch Bridge Mode
                  </label>
                  <select
                    aria-label="Print Dispatch Bridge Mode"
                    value={printMode}
                    onChange={(e) => setPrintMode(e.target.value as ThermalPrintMode)}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-md bg-background"
                  >
                    <option value="BROWSER">Browser Print (80mm / 58mm CSS)</option>
                    <option value="LOCAL_BRIDGE">
                      Local ESC/POS Bridge (Auto-fallback to Browser)
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground">IP Address</label>
                  <input
                    type="text"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-md bg-background font-mono focus:ring-1 focus:ring-primary"
                    placeholder="192.168.1.100"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Local LAN IP of the printer
                  </span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Port</label>
                  <input
                    type="text"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-md bg-background font-mono focus:ring-1 focus:ring-primary"
                    placeholder="9100"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Default Raw TCP port is 9100
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Paper Roll Width
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                    <input
                      type="radio"
                      name="paperWidth"
                      checked={paperWidth === "80"}
                      onChange={() => setPaperWidth("80")}
                      className="accent-primary"
                    />
                    80mm (3 inch - Standard Restaurant Bill)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                    <input
                      type="radio"
                      name="paperWidth"
                      checked={paperWidth === "58"}
                      onChange={() => setPaperWidth("58")}
                      className="accent-primary"
                    />
                    58mm (2 inch - Compact Counter Slip)
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Automation Behaviors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Automation & Triggers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 divide-y">
              <div className="flex items-center justify-between pt-2">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Auto-print Bill on Checkout
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Immediately send receipt to thermal printer when cashier settles an invoice.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoPrintBill}
                  onChange={(e) => setAutoPrintBill(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Auto-print Kitchen KOT Slip
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Print kitchen ticket slip on waiter order submission.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoPrintKOT}
                  onChange={(e) => setAutoPrintKOT(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Kick Cash Drawer on Cash Payment
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Sends pulse signal (ESC p 0) to open connected RJ-11 cash drawer.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={kickDrawer}
                  onChange={(e) => setKickDrawer(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowTestSlip(!showTestSlip)}
              >
                <Eye className="w-4 h-4" />
                {showTestSlip ? "Hide Receipt Preview" : "Preview Test Print Slip"}
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleTestPrint}>
                <Printer className="w-4 h-4 text-[#FF6A00]" />
                Send Test Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => playOrderAlert("Table T1")}
              >
                <Volume2 className="w-4 h-4 text-[#FF6A00]" />
                Test Chime
              </Button>
            </div>
            <Button
              size="sm"
              className="gap-2 bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold"
              onClick={handleSave}
            >
              <Save className="w-4 h-4" />
              Save Printer Settings
            </Button>
          </div>
        </div>

        {/* Live Thermal Receipt Preview Column */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {(
              [
                { id: "BILL", label: "Bill" },
                { id: "KOT", label: "KOT" },
                { id: "TOKEN", label: "Token" },
                { id: "Z_REPORT", label: "Z-Slip" },
                { id: "REFUND", label: "Refund" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPreviewSlipType(tab.id)}
                className={`px-2 py-1 rounded text-[11px] font-bold border ${
                  previewSlipType === tab.id
                    ? "bg-[#0B1F3B] text-white border-[#0B1F3B]"
                    : "bg-card text-muted-foreground border-border"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Card className="bg-muted/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Thermal Print Output ({paperWidth}mm • {previewSlipType})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center p-4">
              <div
                className={`bg-white text-black p-4 font-mono text-xs shadow-md border rounded ${
                  paperWidth === "58" ? "w-52" : "w-64"
                }`}
              >
                <div className="text-center space-y-1 mb-3">
                  <div className="font-bold text-sm tracking-wider">SERVEMYFOOD DEMO</div>
                  <div className="text-[10px] text-gray-600">Anna Salai, Chennai</div>
                  <div className="text-[10px] border-y border-dashed border-gray-400 py-1 my-1 font-bold">
                    DEMO RECEIPT - NOT A TAX INVOICE
                  </div>
                </div>

                {previewSlipType === "KOT" ? (
                  <div className="space-y-2 text-[11px]">
                    <div className="font-black text-center text-sm bg-black text-white py-1">
                      KITCHEN TICKET • TABLE T-04
                    </div>
                    <div className="border-b border-dashed border-gray-400 py-2 space-y-1 font-bold">
                      <div>2x Filter Coffee (No Sugar)</div>
                      <div>1x Ghee Roast Masala Dosa</div>
                    </div>
                  </div>
                ) : previewSlipType === "TOKEN" ? (
                  <div className="space-y-2 text-center">
                    <div className="text-[10px] uppercase font-bold">Counter Pickup Token</div>
                    <div className="text-3xl font-black py-2 border-y border-dashed border-gray-400">
                      #42
                    </div>
                    <div className="text-[11px] text-left space-y-1">
                      <div>2x Filter Coffee</div>
                      <div>1x Masala Dosa</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] mb-2 space-y-0.5 text-gray-700">
                      <div>
                        Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                      </div>
                      <div>
                        {previewSlipType === "REFUND"
                          ? "Refund: RFD-DEMO-001"
                          : previewSlipType === "Z_REPORT"
                            ? "Shift Z-Slip: #001"
                            : "Bill: INV-DEMO-001"}
                      </div>
                      <div>Table: T-04 (AC Hall)</div>
                    </div>

                    <div className="border-t border-b border-dashed border-gray-400 py-2 my-2 space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span>2x Filter Coffee</span>
                        <span className="font-semibold">{formatRupees(9000)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>1x Masala Dosa</span>
                        <span className="font-semibold">{formatRupees(8500)}</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] mb-3">
                      <div className="flex justify-between font-bold text-xs pt-1 border-t border-gray-800">
                        <span>{previewSlipType === "REFUND" ? "REFUND TOTAL" : "TOTAL"}</span>
                        <span>{formatRupees(17500)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-600">
                        <span>Tender: CASH</span>
                        <span>Paid: {formatRupees(20000)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-600">
                        <span>Change Due:</span>
                        <span>{formatRupees(2500)}</span>
                      </div>
                    </div>
                  </>
                )}

                <div className="text-center text-[9px] text-gray-500 border-t border-dashed border-gray-400 pt-2 space-y-0.5">
                  <div>Thank you! Visit again.</div>
                  <div className="text-[8px]">Powered by ServeMyFood Fusion Engine</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
