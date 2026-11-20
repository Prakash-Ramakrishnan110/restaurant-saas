import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Bed,
  QrCode,
  Palette,
  FileCode,
  ChevronDown,
  Eye,
  Store,
  CheckCircle2,
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";
import { apiClient } from "../../api/client";
import { evaluateBrandColor } from "../../lib/colorUtils";
import {
  downloadStandeeCardPNG,
  downloadStandeeCardSVG,
  resolveTableIdentity,
  StandeeCardOptions,
} from "../../lib/qrStandeeGenerator";
import { useTranslation } from "react-i18next";

interface QRCodeItem {
  id: string;
  token?: string;
  public_token: string;
  target_type: "TABLE" | "SERVICE_AREA" | "BRANCH" | "ROOM" | "COUNTER";
  table?: {
    id: string;
    name: string;
    identifier: string;
  } | null;
  table_label?: string;
  section_name?: string;
  service_area?: {
    id: string;
    name: string;
  } | null;
  service_area_name?: string;
  branch: {
    id: string;
    name: string;
  };
  is_active: boolean;
  created_at: string;
}

interface SheetDataItem {
  id: string;
  public_token: string;
  token?: string;
  label: string;
  target_type: string;
  target_id?: string;
  area_name: string;
  section_name?: string;
  branch_name: string;
  public_url: string;
  qr_svg_url?: string;
  qr_png_url?: string;
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

interface BusinessProfileResponse {
  name: string;
  display_name?: string;
  brand_primary_color?: string;
  primary_color?: string;
  logo_url?: string | null;
  logo_128_url?: string | null;
  document_language?: "EN" | "EN_TA";
  business_settings?: {
    display_name?: string;
    brand_primary_color?: string;
    primary_color?: string;
    logo_url?: string | null;
    logo_128_url?: string | null;
    document_language?: "EN" | "EN_TA";
  };
}

function getTargetDetails(item: QRCodeItem | SheetDataItem, origin: string) {
  if ("public_url" in item) {
    const sItem = item as SheetDataItem;
    return {
      publicUrl: sItem.public_url,
      label: sItem.label || "Standee",
      area: sItem.section_name || sItem.area_name || "",
      targetType: sItem.target_type || "TABLE",
    };
  }
  const qItem = item as QRCodeItem;
  const label =
    qItem.table_label || qItem.table?.name || (qItem.target_type === "ROOM" ? "Room" : "Table");
  const area =
    qItem.section_name ||
    qItem.service_area_name ||
    qItem.service_area?.name ||
    (qItem.target_type === "ROOM" ? "Guest Rooms" : "Dining Area");
  const publicUrl = `${origin}/q/${qItem.public_token || qItem.token || ""}`;
  return {
    publicUrl,
    label,
    area,
    targetType: qItem.target_type || "TABLE",
  };
}

interface QRCodesPageProps {
  embedded?: boolean;
}

export const QRCodesPage: React.FC<QRCodesPageProps> = ({ embedded = false }) => {
  const { t } = useTranslation();

  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [sheetData, setSheetData] = useState<SheetDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Business branding for sheet
  const [businessName, setBusinessName] = useState("ServeMyFood Venue");
  const [brandColor, setBrandColor] = useState("#FF6A00");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Rotate Dialog
  const [rotateTarget, setRotateTarget] = useState<QRCodeItem | null>(null);

  // Deactivate Dialog
  const [deactivateTarget, setDeactivateTarget] = useState<QRCodeItem | null>(null);

  // Standee Preview & Customizer Dialog
  const [previewTarget, setPreviewTarget] = useState<QRCodeItem | SheetDataItem | null>(null);
  const [previewTableName, setPreviewTableName] = useState("");
  const [previewTableNumber, setPreviewTableNumber] = useState("");

  // Print Sheet Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [cardsPerPage, setCardsPerPage] = useState<6 | 12>(6);
  const [sheetLanguage, setSheetLanguage] = useState<"EN" | "EN_TA">("EN");
  const [includeLogo, setIncludeLogo] = useState(true);

  const hasRooms = useMemo(() => qrCodes.some((q) => q.target_type === "ROOM"), [qrCodes]);
  const hasTables = useMemo(
    () => qrCodes.some((q) => q.target_type === "TABLE" || !q.target_type),
    [qrCodes]
  );

  const fetchQrCodes = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [qrRes, bizRes, sheetRes] = await Promise.all([
        apiClient.get<{ results: QRCodeItem[] }>("/qr-codes/"),
        apiClient.get<BusinessProfileResponse>("/business/"),
        apiClient.get<SheetDataItem[]>("/qr-codes/sheet-data/"),
      ]);

      setQrCodes(qrRes.data.results || []);
      const bData = bizRes.data;
      const bSettings = bData.business_settings || {};
      setBusinessName(
        bData.display_name || bSettings.display_name || bData.name || "ServeMyFood Venue"
      );
      setBrandColor(
        bData.brand_primary_color ||
          bData.primary_color ||
          bSettings.brand_primary_color ||
          "#FF6A00"
      );
      setLogoUrl(
        bData.logo_128_url || bData.logo_url || bSettings.logo_128_url || bSettings.logo_url || null
      );
      setSheetLanguage(bData.document_language || bSettings.document_language || "EN");
      setSheetData(sheetRes.data || []);
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string }; message?: string };
      setErrorMessage(apiErr.error?.message || apiErr.message || "Failed to load QR codes.");
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
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string }; message?: string };
      setErrorMessage(apiErr.error?.message || apiErr.message || "Failed to rotate QR token.");
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
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string }; message?: string };
      setErrorMessage(apiErr.error?.message || apiErr.message || "Failed to deactivate QR token.");
    } finally {
      setActionLoading(false);
      setDeactivateTarget(null);
    }
  };

  // Open Preview Modal with auto-populated Table Name and Table Number
  const openPreview = (target: QRCodeItem | SheetDataItem) => {
    const details = getTargetDetails(target, window.location.origin);
    const identity = resolveTableIdentity({
      targetLabel: details.label,
      areaName: details.area,
      targetType: details.targetType,
    });
    setPreviewTableName(identity.tableName);
    const numOnly = details.label.replace(/^(T|Room\s*|Table\s*|Counter\s*)/i, "");
    setPreviewTableNumber(numOnly || details.label);
    setPreviewTarget(target);
  };

  // Download Branded Standee Card (Design PNG / SVG)
  const handleDownloadStandee = async (
    qr: QRCodeItem | SheetDataItem,
    format: "png" | "svg" = "png",
    customOptions?: { tableName?: string; tableNumber?: string }
  ) => {
    setActionLoading(true);
    try {
      const details = getTargetDetails(qr, window.location.origin);

      const standeeOpts: StandeeCardOptions = {
        publicUrl: details.publicUrl,
        businessName,
        targetLabel: details.label,
        tableName: customOptions?.tableName || details.area,
        tableNumber: customOptions?.tableNumber,
        areaName: details.area,
        targetType: details.targetType,
        brandColor,
        logoUrl: includeLogo ? logoUrl : null,
        language: sheetLanguage,
        refCode: details.label || qr.id.slice(0, 8),
      };

      const identity = resolveTableIdentity(standeeOpts);

      if (format === "svg") {
        await downloadStandeeCardSVG(
          standeeOpts,
          `standee-${identity.numberHeading}-${identity.tableName}`
        );
      } else {
        await downloadStandeeCardPNG(
          standeeOpts,
          `standee-${identity.numberHeading}-${identity.tableName}`
        );
      }
      setSuccessMessage(`Downloaded designed standee card for ${identity.numberHeading}!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to generate and download standee card.");
    } finally {
      setActionLoading(false);
    }
  };

  // Download Plain QR barcode (PNG / SVG)
  const handlePlainDownload = async (qr: QRCodeItem, format: "svg" | "png") => {
    try {
      const res = await apiClient.get(`/qr-codes/${qr.id}/image/?format=${format}&branded=true`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      const label = qr.table_label || qr.table?.name || "standee";
      link.setAttribute("download", `plain-qr-${label}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setErrorMessage("Failed to download QR code image.");
    }
  };

  // Batch download all cards in the sheet
  const handleDownloadAllStandees = async () => {
    if (sheetData.length === 0) return;
    setBatchDownloading(true);
    try {
      for (const item of sheetData) {
        await handleDownloadStandee(item, "png");
        await new Promise((r) => setTimeout(r, 220));
      }
      setSuccessMessage(`Downloaded all ${sheetData.length} designed standee cards!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      setErrorMessage("Failed during batch download.");
    } finally {
      setBatchDownloading(false);
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
        {embedded ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">{t("qr.title")}</h2>
              <p className="text-xs text-muted-foreground">{t("qr.subtitle")}</p>
            </div>
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
          </div>
        ) : (
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
        )}
      </div>

      {errorMessage && (
        <div className="no-print p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="no-print p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
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
                      <th className="py-3 px-4">
                        {hasRooms && !hasTables
                          ? "Room Number"
                          : !hasRooms && hasTables
                            ? "Table Number"
                            : "Table / Room Number"}
                      </th>
                      <th className="py-3 px-4">
                        {hasRooms && !hasTables
                          ? "Room Name / Floor"
                          : !hasRooms && hasTables
                            ? "Table Name / Section"
                            : "Table / Section Name"}
                      </th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-border">
                    {qrCodes.map((qr) => {
                      const details = getTargetDetails(qr, window.location.origin);
                      const identity = resolveTableIdentity({
                        targetLabel: details.label,
                        areaName: details.area,
                        targetType: details.targetType,
                      });

                      const TargetIcon =
                        qr.target_type === "ROOM"
                          ? Bed
                          : qr.target_type === "COUNTER"
                            ? Store
                            : Utensils;

                      return (
                        <tr key={qr.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-foreground">
                            <div className="flex items-center gap-2.5">
                              <TargetIcon className="w-4 h-4 text-primary flex-shrink-0" />
                              <div>
                                <div className="font-bold text-sm text-foreground">
                                  {identity.numberHeading}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-medium">
                                  Ref: {details.label}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-xs text-foreground">
                              {identity.tableName}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {qr.target_type === "ROOM" ? "Guest Rooms" : "Dining Section"}
                            </div>
                          </td>
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
                            <div className="flex items-center justify-end gap-2">
                              {/* Download Standee Card with Design Dropdown */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="min-h-[36px] px-2.5 text-xs font-semibold gap-1.5 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
                                    title="Download Standee with Design"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                    <ChevronDown className="w-3 h-3 opacity-60" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-xl">
                                  <DropdownMenuItem
                                    onClick={() => handleDownloadStandee(qr, "png")}
                                    className="cursor-pointer font-medium p-2 rounded-lg hover:bg-muted"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded bg-[#FF6A00]/10 text-[#FF6A00] flex items-center justify-center flex-shrink-0">
                                        <Palette className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <div className="text-xs font-bold text-foreground">
                                          Standee Card (Design PNG)
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                          Full card with Table Name &amp; Number
                                        </div>
                                      </div>
                                    </div>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => handleDownloadStandee(qr, "svg")}
                                    className="cursor-pointer font-medium p-2 rounded-lg hover:bg-muted"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
                                        <FileCode className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <div className="text-xs font-bold text-foreground">
                                          Standee Card (Design SVG)
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                          Vector format with full design
                                        </div>
                                      </div>
                                    </div>
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator className="my-1" />

                                  <DropdownMenuItem
                                    onClick={() => openPreview(qr)}
                                    className="cursor-pointer py-1.5 px-2 text-xs"
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                    <span>Preview &amp; Customize Standee</span>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => handlePlainDownload(qr, "png")}
                                    className="cursor-pointer py-1.5 px-2 text-xs"
                                  >
                                    <QrCode className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                    <span>Plain QR Code (PNG)</span>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => handlePlainDownload(qr, "svg")}
                                    className="cursor-pointer py-1.5 px-2 text-xs"
                                  >
                                    <QrCode className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                    <span>Plain QR Code (SVG)</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

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

      {/* Standee Card Live Preview & Customizer Dialog */}
      <Dialog
        open={Boolean(previewTarget)}
        onOpenChange={(open) => !open && setPreviewTarget(null)}
      >
        <DialogContent className="max-w-md max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <span>Standee Card Preview &amp; Customizer</span>
            </DialogTitle>
          </DialogHeader>

          {previewTarget &&
            (() => {
              const details = getTargetDetails(previewTarget, window.location.origin);
              const identity = resolveTableIdentity({
                targetLabel: details.label,
                tableName: previewTableName,
                tableNumber: previewTableNumber,
                areaName: details.area,
                targetType: details.targetType,
              });
              const pUrl = details.publicUrl;

              return (
                <div className="py-2 flex flex-col items-center">
                  {/* Standee Card Frame Mock */}
                  <div
                    className="w-72 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden text-center transition-all duration-200 flex flex-col"
                    style={{
                      borderTop: `8px solid ${brandColor}`,
                    }}
                  >
                    <div className="pt-4 px-4 pb-2 border-b border-slate-100 flex flex-col items-center">
                      {includeLogo && logoUrl ? (
                        <div className="w-14 h-14 rounded-full border border-slate-200 bg-white p-1 flex items-center justify-center mb-1.5 shadow-sm">
                          <img
                            src={logoUrl}
                            alt="Logo"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-base mb-1.5 shadow-sm"
                          style={{
                            backgroundColor: brandColor,
                            color: badgeTextColor,
                          }}
                        >
                          {businessName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <h4 className="font-extrabold text-sm text-slate-900 tracking-tight uppercase">
                        {businessName}
                      </h4>

                      {/* Table Name Pill Badge */}
                      <div className="mt-1 inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 tracking-wide uppercase">
                        Table Name: {identity.tableName}
                      </div>

                      {/* Prominent Table Number Heading */}
                      <div className="mt-1 text-base font-black text-slate-900 tracking-tight">
                        {identity.numberHeading}
                      </div>

                      {sheetLanguage === "EN_TA" && (
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          {identity.tamilHeading}
                        </p>
                      )}
                    </div>

                    <div className="p-3 flex flex-col items-center">
                      <div className="p-2 bg-white border-2 border-slate-200 rounded-xl shadow-inner mb-2">
                        <ClientQRCodeCanvas
                          value={pUrl}
                          size={160}
                          logoUrl={includeLogo ? logoUrl : null}
                          darkColor="#0B1F3B"
                        />
                      </div>
                      <p className="text-xs font-bold text-slate-900 tracking-tight">
                        Scan to see our menu
                      </p>
                      {sheetLanguage === "EN_TA" && (
                        <p className="text-[10px] text-slate-500 font-medium">
                          மெனுவை பார்க்க ஸ்கேன் செய்யவும்
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Point phone camera to browse &amp; order
                      </p>
                    </div>

                    <div className="bg-slate-50 px-3 py-2 border-t border-slate-100 text-[9px] text-slate-400 flex items-center justify-between">
                      <span className="truncate max-w-[170px]">Ref #{identity.numberHeading}</span>
                      <span className="font-bold">ServeMyFood</span>
                    </div>
                  </div>

                  {/* Live Name & Number Editing Box */}
                  <div className="w-full bg-muted/40 p-3 rounded-xl border border-border grid grid-cols-2 gap-3 text-xs mt-3">
                    <div>
                      <label className="font-bold text-foreground block mb-1">
                        Table / Section Name
                      </label>
                      <input
                        type="text"
                        value={previewTableName}
                        onChange={(e) => setPreviewTableName(e.target.value)}
                        placeholder="e.g. Patio Open, Rooftop"
                        className="w-full px-2.5 py-1.5 rounded-md border border-input bg-card text-foreground font-medium"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">
                        Table / Room Number
                      </label>
                      <input
                        type="text"
                        value={previewTableNumber}
                        onChange={(e) => setPreviewTableNumber(e.target.value)}
                        placeholder="e.g. 30, T30, Room 101"
                        className="w-full px-2.5 py-1.5 rounded-md border border-input bg-card text-foreground font-medium"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 w-full">
                    <Button
                      onClick={() =>
                        handleDownloadStandee(previewTarget, "png", {
                          tableName: previewTableName,
                          tableNumber: previewTableNumber,
                        })
                      }
                      disabled={actionLoading}
                      className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold flex-1 min-h-[40px]"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download PNG (With Design)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleDownloadStandee(previewTarget, "svg", {
                          tableName: previewTableName,
                          tableNumber: previewTableNumber,
                        })
                      }
                      disabled={actionLoading}
                      className="min-h-[40px]"
                    >
                      <FileCode className="w-4 h-4 mr-1.5" />
                      SVG
                    </Button>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

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
              {sheetData.map((item) => {
                const itemDetails = getTargetDetails(item, window.location.origin);
                const itemIdentity = resolveTableIdentity({
                  targetLabel: itemDetails.label,
                  areaName: itemDetails.area,
                  targetType: itemDetails.targetType,
                });

                return (
                  <div
                    key={item.id}
                    data-testid="print-qr-card"
                    className="break-inside-avoid relative border-2 border-dashed border-slate-300 rounded-xl p-3.5 bg-white text-slate-900 text-center flex flex-col items-center justify-between shadow-sm"
                    style={{
                      minHeight: cardsPerPage === 6 ? "290px" : "200px",
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

                      {/* Explicit Table Name Pill */}
                      <div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">
                        Table Name: {itemIdentity.tableName}
                      </div>

                      {/* Explicit Table Number Heading */}
                      <div className="mt-0.5 font-black text-xs text-slate-900">
                        {itemIdentity.numberHeading}
                      </div>

                      {sheetLanguage === "EN_TA" && (
                        <p className="text-[9px] text-slate-500 font-medium">
                          {itemIdentity.tamilHeading}
                        </p>
                      )}
                    </div>

                    {/* B1: Client-Side Rendered QR Code (Dark only, EC Level H, Logo overlay) */}
                    <div className="my-2 p-1.5 bg-white border border-slate-200 rounded-lg shadow-inner">
                      <ClientQRCodeCanvas
                        value={item.public_url}
                        size={cardsPerPage === 6 ? 115 : 80}
                        logoUrl={includeLogo ? logoUrl : null}
                        darkColor="#0B1F3B" // B3: Dark only (>= 7:1)
                      />
                    </div>

                    {/* B6: Scan CTA wording */}
                    <div className="w-full">
                      <p className="text-[10px] font-bold text-slate-900 tracking-tight">
                        {t("qr.scanToOrder")}
                      </p>
                      {sheetLanguage === "EN_TA" && (
                        <p className="text-[8px] text-slate-500">மெனுவை பார்க்க ஸ்கேன் செய்யவும்</p>
                      )}
                      {/* B2: Never print secret token prefix. Use short non-secret card reference */}
                      <p className="text-[8px] text-slate-400 mt-0.5 font-mono">
                        Ref: #{itemIdentity.numberHeading}
                      </p>

                      {/* Quick Download Card Action */}
                      <div className="w-full flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-slate-100 no-print">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadStandee(item, "png");
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] inline-flex items-center gap-1 transition-colors"
                          title="Download this standee card (PNG with Design)"
                        >
                          <Download className="w-3 h-3 text-[#FF6A00]" />
                          <span>Download Card</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPreview(item);
                          }}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                          title="Preview & Customize Card"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="no-print pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadAllStandees}
                disabled={batchDownloading || sheetData.length === 0}
                className="min-h-[44px]"
              >
                <Download className={`w-4 h-4 mr-2 ${batchDownloading ? "animate-bounce" : ""}`} />
                {batchDownloading ? "Downloading Cards..." : "Download All Cards (PNG)"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QRCodesPage;
