import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Building2,
  Palette,
  FileText,
} from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { SaveStatusIndicator } from "../../components/app/SaveStatusIndicator";
import { apiClient } from "../../api/client";
import { evaluateBrandColor, isValidGSTIN, ColorContrastCheck } from "../../lib/colorUtils";
import { useTranslation } from "react-i18next";

interface BusinessSettingsData {
  legal_name?: string;
  gstin?: string;
  registered_address?: string;
  document_language?: "EN" | "EN_TA";
  brand_primary_color?: string;
  receipt_footer_text?: string;
  logo_url?: string | null;
  logo_128_url?: string | null;
  display_name?: string;
  tenant_name?: string;
}

export const BrandingSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [displayName, setDisplayName] = useState("");
  const [brandColor, setBrandColor] = useState("#FF6A00");
  const [docLanguage, setDocLanguage] = useState<"EN" | "EN_TA">("EN");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [legalName, setLegalName] = useState("");
  const [gstin, setGstin] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logo128Url, setLogo128Url] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState("ServeMyFood Venue");

  // Logo upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Live contrast evaluation
  const contrastCheck: ColorContrastCheck = evaluateBrandColor(brandColor);
  const gstinValid = isValidGSTIN(gstin);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get<{ business_settings: BusinessSettingsData; name: string }>("/business/")
      .then((res) => {
        if (!isMounted) return;
        const b = res.data.business_settings || {};
        setTenantName(res.data.name || "Restaurant");
        setDisplayName(b.display_name || res.data.name || "");
        setBrandColor(b.brand_primary_color || "#FF6A00");
        setDocLanguage(b.document_language || "EN");
        setReceiptFooter(b.receipt_footer_text || "");
        setLegalName(b.legal_name || "");
        setGstin(b.gstin || "");
        setRegisteredAddress(b.registered_address || "");
        setLogoUrl(b.logo_url || null);
        setLogo128Url(b.logo_128_url || null);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(err.message || "Failed to load business settings.");
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict client-side SVG rejection
    if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
      setLogoError("SVG files are not allowed for security reasons. Please upload a PNG, JPEG, or WebP image.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo file size exceeds the 2 MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setLogoError(null);
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiClient.post<{ logo_url: string; logo_128_url: string }>(
        "/business/logo/",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setLogoUrl(res.data.logo_url);
      setLogo128Url(res.data.logo_128_url);
    } catch (err: any) {
      setLogoError(err.error?.message || err.message || "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLogoDelete = async () => {
    setUploadingLogo(true);
    setLogoError(null);
    try {
      await apiClient.delete("/business/logo/");
      setLogoUrl(null);
      setLogo128Url(null);
    } catch (err: any) {
      setLogoError(err.error?.message || err.message || "Failed to delete logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!contrastCheck.passesThreshold) {
      setErrorMessage("Brand primary color must reach at least 4.5:1 contrast against white or navy.");
      return;
    }
    if (!gstinValid) {
      setErrorMessage("GSTIN must match standard 15-character format (e.g. 33AAAAA0000A1Z5).");
      return;
    }

    setSaveStatus("saving");
    setErrorMessage(null);

    try {
      await apiClient.patch("/business/", {
        display_name: displayName,
        brand_primary_color: brandColor.toUpperCase(),
        document_language: docLanguage,
        receipt_footer_text: receiptFooter,
        legal_name: legalName,
        gstin: gstin.trim().toUpperCase(),
        registered_address: registeredAddress,
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: any) {
      setSaveStatus("error");
      setErrorMessage(err.error?.message || err.message || "Failed to update business branding.");
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-muted-foreground font-semibold">Loading branding preferences...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("branding.title")}
        description={t("branding.subtitle")}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings/venue" },
          { label: "Branding" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <SaveStatusIndicator status={saveStatus} />
            <Button
              type="button"
              onClick={() => handleSave()}
              disabled={saveStatus === "saving" || !contrastCheck.passesThreshold || !gstinValid}
              className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px] px-6"
            >
              {t("common.save")}
            </Button>
          </div>
        }
      />

      {errorMessage && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Logo Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                <CardTitle className="text-base font-bold">{t("branding.logoSection")}</CardTitle>
              </div>
              <CardDescription className="text-xs">{t("branding.logoHelp")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* 128px Preview */}
                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden p-2 relative shadow-sm">
                  {logoUrl ? (
                    <img
                      src={logo128Url || logoUrl}
                      alt="Restaurant Logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground text-center">
                      No Logo Uploaded
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />

                  <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[44px]"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingLogo ? t("common.loading") : t("common.upload")}
                    </Button>

                    {logoUrl && (
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={uploadingLogo}
                        onClick={handleLogoDelete}
                        className="min-h-[44px]"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t("common.delete")}
                      </Button>
                    )}
                  </div>

                  {logoError && (
                    <p className="text-xs text-destructive font-medium">{logoError}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Color & Visual Identity Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                <CardTitle className="text-base font-bold">{t("branding.brandColorSection")}</CardTitle>
              </div>
              <CardDescription className="text-xs">{t("branding.colorHelp")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Hex Code</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={contrastCheck.isValidHex ? brandColor : "#FF6A00"}
                    onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
                    className="w-12 h-12 rounded-lg border border-border cursor-pointer p-1 bg-card"
                  />
                  <Input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    maxLength={7}
                    className="font-mono uppercase max-w-[140px] min-h-[44px]"
                    placeholder="#FF6A00"
                  />
                  <div className="flex-1">
                    {contrastCheck.passesThreshold ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t("branding.contrastPass")}</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                        <AlertTriangle className="w-4 h-4" />
                        <span>{t("branding.contrastFail")}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contrast Ratios Breakdown */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs flex justify-between items-center">
                    <span className="text-muted-foreground">{t("branding.contrastWhite")}:</span>
                    <span className="font-mono font-bold text-foreground">
                      {contrastCheck.contrastAgainstWhite}:1
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs flex justify-between items-center">
                    <span className="text-muted-foreground">{t("branding.contrastNavy")}:</span>
                    <span className="font-mono font-bold text-foreground">
                      {contrastCheck.contrastAgainstNavy}:1
                    </span>
                  </div>
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-foreground">
                  {t("branding.displayName")}
                </label>
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Madurai Tasty Kitchen"
                  className="min-h-[44px]"
                />
              </div>

              {/* Document Language */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {t("onboarding.docLanguage")}
                </label>
                <select
                  value={docLanguage}
                  onChange={(e) => setDocLanguage(e.target.value as "EN" | "EN_TA")}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:ring-2 focus:ring-[#FF6A00] min-h-[44px]"
                >
                  <option value="EN">English Only (EN)</option>
                  <option value="EN_TA">Bilingual English + Tamil (EN / TA)</option>
                </select>
              </div>

              {/* Receipt Footer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    {t("branding.receiptFooter")}
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {receiptFooter.length} / 200
                  </span>
                </div>
                <textarea
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value.slice(0, 200))}
                  placeholder="e.g. Thank you for dining with us! Follow us on Instagram @ourvenue"
                  className="w-full rounded-md border border-input bg-card p-3 text-sm text-foreground shadow-sm focus:ring-2 focus:ring-[#FF6A00] min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Legal & GST Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <CardTitle className="text-base font-bold">{t("branding.legalSection")}</CardTitle>
              </div>
              <CardDescription className="text-xs">{t("branding.accountantNotice")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {t("branding.legalName")}
                </label>
                <Input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. Tasty Foods Private Limited"
                  className="min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {t("branding.gstin")}
                </label>
                <Input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  maxLength={15}
                  placeholder="e.g. 33AAAAA0000A1Z5"
                  className={`font-mono uppercase min-h-[44px] ${
                    !gstinValid ? "border-destructive focus:ring-destructive" : ""
                  }`}
                />
                {!gstinValid ? (
                  <p className="text-xs text-destructive font-medium">
                    Invalid GSTIN format. Must be 15 characters (2 state digits + 10 PAN chars + entity + Z + check char).
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">{t("branding.gstinHelp")}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {t("branding.registeredAddress")}
                </label>
                <textarea
                  value={registeredAddress}
                  onChange={(e) => setRegisteredAddress(e.target.value)}
                  placeholder="Registered commercial address for tax invoices..."
                  className="w-full rounded-md border border-input bg-card p-3 text-sm text-foreground shadow-sm focus:ring-2 focus:ring-[#FF6A00] min-h-[80px]"
                />
              </div>

              {/* Accountant Advisory Note */}
              <div className="p-3.5 rounded-xl bg-muted/60 border border-border/80 flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("branding.accountantNotice")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Live Preview Column */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="sticky top-20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                <CardTitle className="text-base font-bold">{t("branding.qrPreviewTitle")}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Preview of your printed A4 table standee card.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Standee Card Frame */}
              <div className="p-4 bg-muted/20 rounded-2xl border border-dashed border-border flex justify-center">
                <div
                  className="w-64 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden text-center transition-all duration-200"
                  style={{ borderTop: `6px solid ${contrastCheck.isValidHex ? brandColor : "#FF6A00"}` }}
                >
                  <div className="p-4 border-b border-slate-100 flex flex-col items-center">
                    {logoUrl ? (
                      <div className="w-12 h-12 rounded-lg bg-white p-1 border border-slate-100 shadow-sm flex items-center justify-center mb-2">
                        <img
                          src={logo128Url || logoUrl}
                          alt="Logo Preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm mb-2 shadow"
                        style={{
                          backgroundColor: contrastCheck.isValidHex ? brandColor : "#FF6A00",
                          color: contrastCheck.recommendedTextHex, // Requirement B4: contrast >= 4.5:1, navy on #FF6A00
                        }}
                      >
                        {(displayName || tenantName).slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <h4 className="font-extrabold text-slate-900 text-sm tracking-tight truncate max-w-full">
                      {displayName || tenantName}
                    </h4>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                      Main Dining • Table 04
                    </p>
                    {docLanguage === "EN_TA" && (
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        முதன்மை மண்டபம் • மேஜை 04
                      </p>
                    )}
                  </div>

                  {/* QR Box - Requirement B3: dark QR only (>= 7:1) labelled Sample */}
                  <div className="p-5 flex flex-col items-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 uppercase tracking-wider mb-2">
                      Sample
                    </span>
                    <div className="w-32 h-32 bg-slate-50 border-2 border-slate-200 rounded-lg flex items-center justify-center relative p-2 shadow-inner">
                      <QrCode className="w-24 h-24 text-[#0B1F3B]" />
                    </div>

                    <p className="mt-3 text-[11px] font-bold text-slate-800">
                      {t("qr.scanToOrder")}
                    </p>
                    {docLanguage === "EN_TA" && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        மெனுவை பார்க்க ஸ்கேன் செய்யவும்
                      </p>
                    )}
                  </div>

                  <div className="bg-slate-50 px-3 py-2 border-t border-slate-100 text-[9px] text-slate-400">
                    ServeMyFood Standee • Ref #SMF-T04
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
