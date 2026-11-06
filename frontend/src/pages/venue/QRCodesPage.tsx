import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import {
  Printer,
  RotateCw,
  Trash2,
  Download,
  AlertTriangle,
  Scissors,
  Utensils,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { apiClient } from "../../api/client";
import { evaluateBrandColor } from "../../lib/colorUtils";
import { useTranslation } from "react-i18next";

interface QRCodeItem {
  id: string;
  token: string;
  target_type: "TABLE" | "SERVICE_AREA" | "BRANCH";
  table?: {
    id: string;
    name: string;
    identifier: string;
  } | null;
  service_area?: {
    id: string;
    name: string;
  } | null;
  branch: {
    id: string;
    name: string;
  };
  is_active: boolean;
  created_at: string;
}

interface SheetDataItem {
  id: string;
  token: string;
  label: string;
  target_type: string;
  target_id: string;
  area_name: string;
  branch_name: string;
  public_url: string;
  qr_svg_url: string;
  qr_png_url: string;
}

// Client-side QR renderer guaranteeing error correction H, dark color, and logo overlay
export const ClientQRCodeCanvas: React.FC<{
  value: string;
  size: number;
  logoUrl?: string | null;
  className?: string;
  darkColor?: string;
}> = ({ value, size, logoUrl, className, darkColor = "#0B1F3B" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    const canvas = canvasRef.current;

    // Requirement B3: Dark color only (at least 7:1 against white)
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "H",
      color: {
        dark: darkColor,
        light: "#FFFFFF",
      },
    }).then(() => {
      if (logoUrl) {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = logoUrl;
        img.onload = () => {
          // B1: Logo overlay 20% max width
          const logoSize = Math.floor(size * 0.2);
          const center = Math.floor((size - logoSize) / 2);
          const pad = 3;
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(center + logoSize / 2, center + logoSize / 2, logoSize / 2 + pad, 0, Math.PI * 2);
          ctx.fill();
          ctx.drawImage(img, center, center, logoSize, logoSize);
        };
      }
    });
  }, [value, size, logoUrl, darkColor]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      data-testid="client-qr-canvas"
    />
  );
};

export const QRCodesPage: React.FC = () => {
  const { t } = useTranslation();

  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [sheetData, setSheetData] = useState<SheetDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Business branding for sheet
  const [businessName, setBusinessName] = useState("ServeMyFood Venue");
  const [brandColor, setBrandColor] = useState("#FF6A00");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Rotate Dialog
  const [rotateTarget, setRotateTarget] = useState<QRCodeItem | null>(null);

  // Deactivate Dialog
  const [deactivateTarget, setDeactivateTarget] = useState<QRCodeItem | null>(null);

  // Print Sheet Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [cardsPerPage, setCardsPerPage] = useState<6 | 12>(6);
  const [sheetLanguage, setSheetLanguage] = useState<"EN" | "EN_TA">("EN");
  const [includeLogo, setIncludeLogo] = useState(true);

  const fetchQrCodes = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [qrRes, bizRes, sheetRes] = await Promise.all([
        apiClient.get<{ results: QRCodeItem[] }>("/qr-codes/"),
        apiClient.get<{ business_settings: any; name: string }>("/business/"),
        apiClient.get<SheetDataItem[]>("/qr-codes/sheet-data/"),
      ]);

      setQrCodes(qrRes.data.results || []);
      const bSettings = bizRes.data.business_settings || {};
      setBusinessName(bSettings.display_name || bizRes.data.name || "ServeMyFood Venue");
      setBrandColor(bSettings.brand_primary_color || "#FF6A00");
      setLogoUrl(bSettings.logo_url || null);
      setSheetLanguage(bSettings.document_language || "EN");
      setSheetData(sheetRes.data || []);
    } catch (err: any) {
      setErrorMessage(err.error?.message || err.message || "Failed to load QR codes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQrCodes();
  }, []);

  const handleRotate = async () => {
    if (!rotateTarget) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/qr-codes/${rotateTarget.id}/rotate/`);
      await fetchQrCodes();
    } catch (err: any) {
      setErrorMessage(err.error?.message || err.message || "Failed to rotate QR token.");
    } finally {
      setActionLoading(false);
      setRotateTarget(null);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setActionLoading(true);
    try {
      await apiClient.delete(`/qr-codes/${deactivateTarget.id}/`);
      await fetchQrCodes();
    } catch (err: any) {
      setErrorMessage(err.error?.message || err.message || "Failed to deactivate QR token.");
    } finally {
      setActionLoading(false);
      setDeactivateTarget(null);
    }
  };

  // Requirement B1: downloads fetch the image as a blob through API client with auth
  const handleDownload = async (qr: QRCodeItem, format: "svg" | "png") => {
    try {
      const res = await apiClient.get(`/qr-codes/${qr.id}/image/?format=${format}&branded=true`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `qr-${qr.table?.name || "standee"}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setErrorMessage("Failed to download QR code image.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Requirement B4: choose navy or white by contrast (never white on #FF6A00)
  const badgeTextColor = evaluateBrandColor(brandColor).recommendedTextHex;

  return (
    <div className="space-y-6">
      {/* Page Header (Hidden on Print) */}
      <div className="no-print">
        <PageHeader
          title={t("qr.title")}
          description={t("qr.subtitle")}
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "QR Codes" }]}
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={fetchQrCodes}
                disabled={loading}
                className="min-h-[44px]"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                onClick={() => setPrintModalOpen(true)}
                disabled={loading || sheetData.length === 0}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
              >
                <Printer className="w-4 h-4 mr-2" />
                {t("qr.printSheetButton")}
              </Button>
            </div>
          }
        />
      </div>

      {errorMessage && (
        <div className="no-print p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* QR Codes Table View (Hidden on Print) */}
      <div className="no-print">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Active QR Standees</CardTitle>
                <CardDescription className="text-xs">
                  {qrCodes.length} active QR tokens configured across your dining areas.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs text-muted-foreground font-semibold">
                  Loading QR standees...
                </span>
              </div>
            ) : qrCodes.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No active QR codes found. Apply a layout template in Onboarding or generate QR codes
                for tables.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase font-semibold text-muted-foreground">
                      <th className="py-3 px-4">Location / Target</th>
                      <th className="py-3 px-4">Area</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {qrCodes.map((qr) => {
                      const label = qr.table
                        ? qr.table.name
                        : qr.service_area
                          ? qr.service_area.name
                          : "Branch";
                      const areaName = qr.service_area ? qr.service_area.name : "General Area";
                      return (
                        <tr key={qr.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
                            <Utensils className="w-4 h-4 text-primary" />
                            <span>{label}</span>
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground text-xs">{areaName}</td>
                          <td className="py-3.5 px-4">
                            {qr.is_active ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Authenticated Download SVG */}
                              <button
                                type="button"
                                onClick={() => handleDownload(qr, "svg")}
                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground inline-flex items-center justify-center min-w-[36px] min-h-[36px]"
                                title="Download SVG"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              {/* Rotate Token */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRotateTarget(qr)}
                                className="min-h-[36px] px-2.5 text-xs"
                                title="Rotate QR Token"
                              >
                                <RotateCw className="w-3.5 h-3.5 mr-1" />
                                Rotate
                              </Button>

                              {/* Deactivate */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeactivateTarget(qr)}
                                className="min-h-[36px] px-2.5 text-xs text-destructive hover:bg-destructive/10"
                                title="Deactivate QR Code"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rotate Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(rotateTarget)}
        onOpenChange={(open) => !open && setRotateTarget(null)}
        title={t("qr.rotateTitle")}
        description={t("qr.rotateWarning")}
        confirmLabel="Rotate Token Now"
        variant="destructive"
        isLoading={actionLoading}
        onConfirm={handleRotate}
      />

      {/* Deactivate Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate QR Code?"
        description="This will permanently disable this QR standee. Guests scanning it will see an inactive code message."
        confirmLabel="Deactivate"
        variant="destructive"
        isLoading={actionLoading}
        onConfirm={handleDeactivate}
      />

      {/* Print Sheet Dialog / Modal */}
      <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              <span>A4 QR Standee Print Sheet Preview</span>
            </DialogTitle>
          </DialogHeader>

          {/* Controls Bar (Hidden during Print) */}
          <div className="no-print p-4 rounded-xl bg-muted/40 border border-border grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold block mb-1.5">{t("qr.cardsPerPage")}</label>
              <select
                aria-label="Cards per sheet layout"
                value={cardsPerPage}
                onChange={(e) => setCardsPerPage(Number(e.target.value) as 6 | 12)}
                className="w-full rounded-md border border-input bg-card p-2 min-h-[36px]"
              >
                <option value={6}>6 per page (Large Standee)</option>
                <option value={12}>12 per page (Compact Tent)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1.5">{t("onboarding.docLanguage")}</label>
              <select
                aria-label="Sheet language"
                value={sheetLanguage}
                onChange={(e) => setSheetLanguage(e.target.value as "EN" | "EN_TA")}
                className="w-full rounded-md border border-input bg-card p-2 min-h-[36px]"
              >
                <option value="EN">English Only</option>
                <option value="EN_TA">Bilingual (English + Tamil)</option>
              </select>
            </div>

            <div className="flex flex-col justify-center">
              <label className="inline-flex items-center gap-2 cursor-pointer mt-3">
                <input
                  type="checkbox"
                  checked={includeLogo}
                  onChange={(e) => setIncludeLogo(e.target.checked)}
                  className="rounded border-border text-[#FF6A00] focus:ring-[#FF6A00]"
                />
                <span className="font-medium">{t("qr.includeLogo")}</span>
              </label>
            </div>
          </div>

          {/* Printable A4 Sheet Container */}
          <div className="qr-sheet-print-container py-4">
            <div className={`grid gap-4 ${cardsPerPage === 6 ? "grid-cols-2" : "grid-cols-3"}`}>
              {sheetData.map((item, idx) => (
                <div
                  key={item.id}
                  data-testid="print-qr-card"
                  className="break-inside-avoid relative border-2 border-dashed border-slate-300 rounded-xl p-4 bg-white text-slate-900 text-center flex flex-col items-center justify-between shadow-sm"
                  style={{
                    minHeight: cardsPerPage === 6 ? "280px" : "190px",
                    // B3: Brand color appears only in top strip and initials badge
                    borderTop: `6px solid ${brandColor}`,
                  }}
                >
                  {/* Cut icon indicator in corner */}
                  <div className="absolute top-1.5 right-1.5 text-slate-400 no-print flex items-center gap-1">
                    <Scissors className="w-3 h-3" />
                  </div>

                  {/* Header: Logo / Badge & Restaurant Name */}
                  <div className="w-full flex flex-col items-center">
                    {includeLogo && logoUrl ? (
                      <div className="w-8 h-8 rounded mb-1 bg-white p-0.5 flex items-center justify-center">
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs mb-1 shadow-sm"
                        style={{
                          backgroundColor: brandColor,
                          color: badgeTextColor, // B4: Never white on #FF6A00
                        }}
                      >
                        {businessName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <h5 className="font-extrabold text-xs tracking-tight text-slate-900 uppercase truncate max-w-full">
                      {businessName}
                    </h5>
                    <div className="mt-1 inline-block px-2 py-0.5 rounded bg-slate-100 text-[11px] font-bold text-slate-800">
                      {item.area_name ? `${item.area_name} • ` : ""}
                      {item.label}
                    </div>
                    {sheetLanguage === "EN_TA" && (
                      <p className="text-[9px] text-slate-500 font-medium">
                        {item.target_type === "TABLE" ? "மேஜை" : "கவுண்டர்"}
                      </p>
                    )}
                  </div>

                  {/* B1: Client-Side Rendered QR Code (Dark only, EC Level H, Logo overlay) */}
                  <div className="my-2 p-1.5 bg-white border border-slate-200 rounded-lg shadow-inner">
                    <ClientQRCodeCanvas
                      value={item.public_url}
                      size={cardsPerPage === 6 ? 120 : 85}
                      logoUrl={includeLogo ? logoUrl : null}
                      darkColor="#0B1F3B" // B3: Dark only (>= 7:1)
                    />
                  </div>

                  {/* B6: Scan CTA wording: "Scan to see our menu", never "Scan to View Menu & Order" */}
                  <div className="w-full">
                    <p className="text-[10px] font-bold text-slate-900 tracking-tight">
                      {t("qr.scanToOrder")}
                    </p>
                    {sheetLanguage === "EN_TA" && (
                      <p className="text-[8px] text-slate-500">மெனுவை பார்க்க ஸ்கேன் செய்யவும்</p>
                    )}
                    {/* B2: Never print secret token prefix. Use short non-secret card reference */}
                    <p className="text-[8px] text-slate-400 mt-1 font-mono">
                      Ref: #{item.label || idx + 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="no-print pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setPrintModalOpen(false)}>
              Close
            </Button>
            <Button
              onClick={handlePrint}
              className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print to A4 Paper
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QRCodesPage;
