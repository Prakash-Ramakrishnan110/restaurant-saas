import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Coffee,
  UtensilsCrossed,
  Sparkles,
  Hotel,
  Zap,
  Truck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Building,
  Clock,
  QrCode,
  Users,
  Shield,
  Layers,
  Printer,
  Sliders,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Stepper, StepItem } from "../../components/ui/stepper";
import { RadioCard } from "../../components/ui/radio-card";
import { SaveStatusIndicator, SaveStatus } from "../../components/app/SaveStatusIndicator";
import { apiClient } from "../../api/client";
import { useTranslation } from "react-i18next";

export const WIZARD_STEPS: StepItem[] = [
  { id: "business", title: "Business" },
  { id: "branch", title: "Branch" },
  { id: "style", title: "Service Style" },
  { id: "layout", title: "Layout" },
  { id: "qr", title: "QR Codes" },
  { id: "staff", title: "Staff" },
  { id: "done", title: "Ready" },
];

export const OnboardingWizardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tenant / Business State
  const [businessName, setBusinessName] = useState("");
  const [venueProfile, setVenueProfile] = useState("CAFE"); // Café default highlighted
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [docLanguage, setDocLanguage] = useState<"EN" | "EN_TA">("EN");

  // Branch State
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [operatingHours, setOperatingHours] = useState([
    { day: "Monday", open: "08:00", close: "22:00", closed: false },
    { day: "Tuesday", open: "08:00", close: "22:00", closed: false },
    { day: "Wednesday", open: "08:00", close: "22:00", closed: false },
    { day: "Thursday", open: "08:00", close: "22:00", closed: false },
    { day: "Friday", open: "08:00", close: "23:00", closed: false },
    { day: "Saturday", open: "08:00", close: "23:00", closed: false },
    { day: "Sunday", open: "08:00", close: "22:00", closed: false },
  ]);

  // Layout State
  const [layoutTemplates, setLayoutTemplates] = useState<any[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("cafe_small");
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [applyingLayout, setApplyingLayout] = useState(false);

  // QR Standees State
  const [qrItems, setQrItems] = useState<any[]>([]);

  // Staff Invite State
  const [staffRole, setStaffRole] = useState("WAITER");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [invitingStaff, setInvitingStaff] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Summary State
  const [summaryStats, setSummaryStats] = useState({
    branches_count: 1,
    service_areas_count: 0,
    tables_count: 0,
    qr_codes_count: 0,
    staff_count: 0,
  });

  // Load initial onboarding status and resume step
  useEffect(() => {
    let isMounted = true;
    const loadStatus = async () => {
      setLoading(true);
      try {
        const [statusRes, bizRes, branchRes] = await Promise.all([
          apiClient.get<any>("/onboarding/status/"),
          apiClient.get<any>("/business/"),
          apiClient.get<any>("/branches/"),
        ]);

        if (!isMounted) return;

        const onb = statusRes.data;
        const biz = bizRes.data;
        const bList = branchRes.data.results || [];

        setBusinessName(biz.name || "");
        setVenueProfile(biz.venue_profile || "CAFE");
        setContactEmail(biz.contact_email || "");
        setContactPhone(biz.contact_phone || "");
        setTimezone(biz.timezone || "Asia/Kolkata");
        if (biz.business_settings?.document_language) {
          setDocLanguage(biz.business_settings.document_language);
        }

        if (bList.length > 0) {
          const firstB = bList[0];
          setBranchId(firstB.id);
          setBranchName(firstB.name || "");
          setBranchAddress(firstB.address || "");
          setBranchPhone(firstB.phone || "");
        } else {
          setBranchName(biz.name ? `${biz.name} - Main` : "Main Branch");
        }

        if (onb.summary) {
          setSummaryStats(onb.summary);
        }

        // Resume at first incomplete step
        const stepMap: Record<string, number> = {
          business: 0,
          branch: 1,
          style: 2,
          layout: 3,
          qr: 4,
          staff: 5,
          done: 6,
        };
        if (onb.next_step && stepMap[onb.next_step] !== undefined) {
          setCurrentStep(stepMap[onb.next_step]);
        }
      } catch (err: any) {
        setErrorMessage(err.error?.message || err.message || "Failed to load onboarding status.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch templates when step becomes 3 (Layout)
  useEffect(() => {
    if (currentStep === 3) {
      apiClient
        .get<any[]>(`/layout-templates/?venue_profile=${venueProfile}`)
        .then((res) => {
          setLayoutTemplates(res.data || []);
          if (res.data.length > 0) {
            const hasDefault = res.data.some((t: any) => t.key === selectedTemplateKey);
            if (!hasDefault) {
              setSelectedTemplateKey(res.data[0].key);
            }
          }
        })
        .catch(() => {});
    }
  }, [currentStep, venueProfile, selectedTemplateKey]);

  // Run dry-run when selected template changes
  useEffect(() => {
    if (currentStep === 3 && branchId && selectedTemplateKey) {
      apiClient
        .post<any>(`/branches/${branchId}/layout-templates/${selectedTemplateKey}/apply/?dry_run=true`, {
          mode: "replace",
        })
        .then((res) => {
          setDryRunResult(res.data);
        })
        .catch((err) => {
          setDryRunResult({
            is_allowed: false,
            error_code: err.error?.code || "ERROR",
            error_message: err.error?.message || "Template check failed.",
          });
        });
    }
  }, [currentStep, branchId, selectedTemplateKey]);

  // Fetch QR codes when step becomes 4 (QR)
  useEffect(() => {
    if (currentStep === 4) {
      apiClient
        .get<any>("/qr-codes/")
        .then((res) => {
          setQrItems(res.data.results || []);
        })
        .catch(() => {});
    }
  }, [currentStep]);

  // Step 1: Save Business
  const saveBusinessDetails = async () => {
    setSaveStatus("saving");
    try {
      await apiClient.patch("/business/", {
        name: businessName,
        venue_profile: venueProfile,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        timezone: timezone,
        document_language: docLanguage,
      });
      setSaveStatus("saved");
      return true;
    } catch (err: any) {
      setSaveStatus("error");
      setErrorMessage(err.error?.message || err.message || "Failed to update business details.");
      return false;
    }
  };

  // Step 2: Save Branch
  const saveBranchDetails = async () => {
    setSaveStatus("saving");
    try {
      if (branchId) {
        await apiClient.patch(`/branches/${branchId}/`, {
          name: branchName,
          address: branchAddress,
          phone: branchPhone,
          operating_hours: { days: operatingHours },
        });
      } else {
        const res = await apiClient.post<{ id: string }>("/branches/", {
          name: branchName,
          address: branchAddress,
          phone: branchPhone,
          operating_hours: { days: operatingHours },
        });
        setBranchId(res.data.id);
      }
      setSaveStatus("saved");
      return true;
    } catch (err: any) {
      setSaveStatus("error");
      setErrorMessage(err.error?.message || err.message || "Failed to update branch details.");
      return false;
    }
  };

  // Step 4: Apply Layout Template
  const handleApplyLayout = async () => {
    if (!branchId || !selectedTemplateKey) return;
    setApplyingLayout(true);
    setErrorMessage(null);
    try {
      await apiClient.post(`/branches/${branchId}/layout-templates/${selectedTemplateKey}/apply/`, {
        mode: "replace",
      });
      setSaveStatus("saved");
      // Advance to QR step
      setCurrentStep(4);
    } catch (err: any) {
      setErrorMessage(
        err.error?.message ||
          (err.error?.code === "ENTITLEMENT_LIMIT_REACHED"
            ? "Template exceeds your subscription plan table capacity. Please choose a smaller layout or upgrade."
            : "Failed to apply layout template.")
      );
    } finally {
      setApplyingLayout(false);
    }
  };

  // Step 6: Invite Staff Member
  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffEmail) return;
    setInvitingStaff(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.post<any>("/staff/", {
        full_name: staffName,
        email: staffEmail,
        role: staffRole,
        phone: staffPhone,
        branch_ids: branchId ? [branchId] : [],
      });
      if (res.data.temporary_password) {
        setTemporaryPassword(res.data.temporary_password);
      }
      setSaveStatus("saved");
    } catch (err: any) {
      setErrorMessage(err.error?.message || err.message || "Failed to add staff member.");
    } finally {
      setInvitingStaff(false);
    }
  };

  const handleCopyPassword = () => {
    if (temporaryPassword) {
      navigator.clipboard.writeText(temporaryPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 3000);
    }
  };

  const handleNext = async () => {
    setErrorMessage(null);
    if (currentStep === 0) {
      const ok = await saveBusinessDetails();
      if (!ok) return;
    } else if (currentStep === 1) {
      const ok = await saveBranchDetails();
      if (!ok) return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  };

  const handleBack = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const copyHoursToAll = () => {
    const monday = operatingHours[0];
    setOperatingHours(
      operatingHours.map((h) => ({
        ...h,
        open: monday.open,
        close: monday.close,
        closed: monday.closed,
      }))
    );
  };

  const isCounterMode =
    venueProfile === "QUICK_SERVICE" || selectedTemplateKey === "counters";

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm text-muted-foreground font-semibold">
          Loading onboarding wizard...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {t("onboarding.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("onboarding.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatusIndicator status={saveStatus} />
        </div>
      </div>

      {/* Stepper Bar */}
      <Card className="p-4 sm:p-6 bg-card">
        <Stepper
          steps={WIZARD_STEPS}
          currentStepIndex={currentStep}
          onStepClick={(idx) => idx <= currentStep && setCurrentStep(idx)}
        />
      </Card>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: Business Details */}
      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              <CardTitle>{t("onboarding.step1Title")}</CardTitle>
            </div>
            <CardDescription>{t("onboarding.step1Desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                {t("onboarding.businessName")} *
              </label>
              <Input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Kaapi & Conversations Café"
                className="min-h-[44px]"
              />
            </div>

            {/* Business Type / Venue Profile RadioCards */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                {t("onboarding.businessType")}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <RadioCard
                  id="vp-cafe"
                  name="venue_profile"
                  value="CAFE"
                  checked={venueProfile === "CAFE"}
                  onChange={setVenueProfile}
                  title="Café"
                  description="Counter ordering, cozy dine-in, coffee & bakery."
                  badge="Default"
                  icon={<Coffee className="w-5 h-5" />}
                />
                <RadioCard
                  id="vp-rest"
                  name="venue_profile"
                  value="RESTAURANT"
                  checked={venueProfile === "RESTAURANT"}
                  onChange={setVenueProfile}
                  title="Restaurant"
                  description="Multi-section dining, AC hall, family dining."
                  icon={<UtensilsCrossed className="w-5 h-5" />}
                />
                <RadioCard
                  id="vp-fine"
                  name="venue_profile"
                  value="FINE_DINING"
                  checked={venueProfile === "FINE_DINING"}
                  onChange={setVenueProfile}
                  title="Fine Dining"
                  description="Captain-assisted courses, table sessions, bar stools."
                  icon={<Sparkles className="w-5 h-5" />}
                />
                <RadioCard
                  id="vp-hotel"
                  name="venue_profile"
                  value="HOTEL_RESTAURANT"
                  checked={venueProfile === "HOTEL_RESTAURANT"}
                  onChange={setVenueProfile}
                  title="Hotel Dining"
                  description="Room service, lobby lounge, banquet halls."
                  icon={<Hotel className="w-5 h-5" />}
                />
                <RadioCard
                  id="vp-quick"
                  name="venue_profile"
                  value="QUICK_SERVICE"
                  checked={venueProfile === "QUICK_SERVICE"}
                  onChange={setVenueProfile}
                  title="Quick Service / Tea Shop"
                  description="Express takeaway, token counters, zero dining furniture."
                  icon={<Zap className="w-5 h-5" />}
                />
                <RadioCard
                  id="vp-truck"
                  name="venue_profile"
                  value="FOOD_TRUCK"
                  checked={venueProfile === "FOOD_TRUCK"}
                  onChange={setVenueProfile}
                  title="Food Truck / Pop-Up"
                  description="Fast counter service, single pickup station."
                  icon={<Truck className="w-5 h-5" />}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {t("onboarding.contactEmail")}
                </label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="owner@myrestaurant.com"
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {t("onboarding.contactPhone")}
                </label>
                <Input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {t("onboarding.timezone")}
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:ring-2 focus:ring-[#FF6A00] min-h-[44px]"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT +8:00)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

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
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Branch Details */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              <CardTitle>{t("onboarding.step2Title")}</CardTitle>
            </div>
            <CardDescription>{t("onboarding.step2Desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t("onboarding.branchName")} *
              </label>
              <Input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g. Anna Nagar Flagship"
                className="min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {t("onboarding.branchAddress")}
                </label>
                <Input
                  type="text"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="12 2nd Avenue, Anna Nagar, Chennai"
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {t("onboarding.branchPhone")}
                </label>
                <Input
                  type="tel"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  placeholder="+91 44 2626 0000"
                  className="min-h-[44px]"
                />
              </div>
            </div>

            {/* Operating Hours */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {t("onboarding.operatingHours")}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyHoursToAll}
                  className="min-h-[36px] text-xs"
                >
                  {t("onboarding.copyToAll")}
                </Button>
              </div>

              <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                {operatingHours.map((h, idx) => (
                  <div
                    key={h.day}
                    className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <span className="font-semibold text-foreground w-28">{h.day}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-[11px]">{t("onboarding.openTime")}:</span>
                        <input
                          type="time"
                          value={h.open}
                          disabled={h.closed}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOperatingHours(
                              operatingHours.map((item, i) =>
                                i === idx ? { ...item, open: val } : item
                              )
                            );
                          }}
                          className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground disabled:opacity-40"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-[11px]">{t("onboarding.closeTime")}:</span>
                        <input
                          type="time"
                          value={h.close}
                          disabled={h.closed}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOperatingHours(
                              operatingHours.map((item, i) =>
                                i === idx ? { ...item, close: val } : item
                              )
                            );
                          }}
                          className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground disabled:opacity-40"
                        />
                      </div>
                      <label className="flex items-center gap-1 cursor-pointer pl-2">
                        <input
                          type="checkbox"
                          checked={h.closed}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setOperatingHours(
                              operatingHours.map((item, i) =>
                                i === idx ? { ...item, closed: val } : item
                              )
                            );
                          }}
                          className="rounded border-border text-[#FF6A00]"
                        />
                        <span className="text-[11px] text-muted-foreground">{t("onboarding.closed")}</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Service Style & Preset Capabilities */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              <CardTitle>{t("onboarding.step3Title")}</CardTitle>
            </div>
            <CardDescription>{t("onboarding.step3Desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Active Venue Preset:
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FF6A00]/15 text-[#B45309] dark:text-[#FF6A00]">
                  {venueProfile}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
                <div className="p-3 rounded-lg bg-card border border-border">
                  <span className="font-semibold text-foreground block mb-1">
                    Ordering Workflow
                  </span>
                  <p className="text-muted-foreground">
                    {venueProfile === "FINE_DINING" || venueProfile === "HOTEL_RESTAURANT"
                      ? "Browse Only (Captain / staff enters order into POS)"
                      : "Direct Ordering (Guests scan QR and order directly)"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border">
                  <span className="font-semibold text-foreground block mb-1">
                    Dining Session Policy
                  </span>
                  <p className="text-muted-foreground">
                    {venueProfile === "FINE_DINING" || venueProfile === "HOTEL_RESTAURANT"
                      ? "Staff Only (Staff opens session upon seating)"
                      : "Customer Can Open (Scan opens immediate active session)"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#FF6A00] flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-foreground">
                <span className="font-bold">Automated Operational Rules: </span>
                Preset capabilities are configured out-of-the-box according to hospitality standards for {venueProfile}. You can customize granular overrides at any time in Branch Settings.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Layout & Capacity */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              <CardTitle>{t("onboarding.step4Title")}</CardTitle>
            </div>
            <CardDescription>{t("onboarding.step4Desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* STRICT INVARIANT: If counter mode, ZERO occurrence of the word "table" or "மேஜை" */}
            {isCounterMode && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                {t("onboarding.counterNote")}
              </div>
            )}

            <div className="space-y-3">
              <label className="text-xs font-semibold text-foreground">
                Choose a Template for your Branch:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {layoutTemplates.map((template) => {
                  const isCountersTemplate = template.key === "counters";
                  return (
                    <div
                      key={template.key}
                      onClick={() => setSelectedTemplateKey(template.key)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all min-h-[56px] flex flex-col justify-between ${
                        selectedTemplateKey === template.key
                          ? "border-[#FF6A00] bg-[#FF6A00]/5 dark:bg-[#FF6A00]/10"
                          : "border-border hover:border-muted-foreground/30 bg-card"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">
                            {isCountersTemplate
                              ? "Counters and token numbers"
                              : template.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {isCountersTemplate
                              ? "Takeaway counter service areas and sequential token numbers without dining furniture."
                              : template.description}
                          </p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border shrink-0 mt-1 flex items-center justify-center ${
                            selectedTemplateKey === template.key
                              ? "border-[#FF6A00] bg-[#FF6A00]"
                              : "border-muted-foreground"
                          }`}
                        >
                          {selectedTemplateKey === template.key && (
                            <div className="w-1.5 h-1.5 rounded-full bg-[#0B1F3B]" />
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-4 text-xs font-medium text-muted-foreground">
                        <span>Areas: {template.areas_count || 1}</span>
                        <span>
                          {isCountersTemplate
                            ? `Counters: ${template.counters_count || 2}`
                            : `Seats / Furniture: ${template.tables_count || 0}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dry Run Plan Limit Warning / Confirmation */}
            {dryRunResult && (
              <div className="p-4 rounded-xl border space-y-2">
                {dryRunResult.is_allowed ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Layout fits within your subscription plan entitlements.</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 text-xs text-destructive font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p>
                        This layout template exceeds your plan capacity (
                        {dryRunResult.error_message || "Plan limit reached"}).
                      </p>
                      <p className="font-normal text-muted-foreground mt-1">
                        Please choose a smaller layout template or upgrade your plan.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button
              type="button"
              disabled={applyingLayout || (dryRunResult && !dryRunResult.is_allowed)}
              onClick={handleApplyLayout}
              className="w-full bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
            >
              {applyingLayout ? "Creating Layout..." : "Apply This Layout & Continue"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 5: QR Codes Review */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              <CardTitle>{t("onboarding.step5Title")}</CardTitle>
            </div>
            <CardDescription>{t("onboarding.step5Desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-foreground">
                  {qrItems.length} QR Standees Ready
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cryptographic tokens generated for tables and counters.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/qr")}
                className="min-h-[44px]"
              >
                <Printer className="w-4 h-4 mr-2" />
                {t("qr.printSheetButton")}
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
              {qrItems.slice(0, 8).map((qr) => (
                <div
                  key={qr.id}
                  className="p-3 rounded-lg border border-border bg-card text-center flex flex-col items-center justify-center shadow-sm"
                >
                  <QrCode className="w-8 h-8 text-primary mb-1.5" />
                  <span className="text-xs font-bold text-foreground truncate w-full">
                    {qr.table ? qr.table.name : "Counter"}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {qr.token.slice(0, 6)}...
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 6: Team & Staff Invite (Optional) */}
      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle>{t("onboarding.step6Title")}</CardTitle>
            </div>
            <CardDescription>{t("onboarding.step6Desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {temporaryPassword ? (
              <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-amber-900 dark:text-amber-100">
                      Staff Member Created Successfully
                    </h4>
                    <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                      {t("onboarding.tempPasswordWarning")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200 dark:border-amber-900">
                  <span className="font-mono font-bold text-sm text-foreground flex-1 tracking-wider">
                    {temporaryPassword}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopyPassword}
                    className="min-h-[36px] bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold text-xs"
                  >
                    {passwordCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" /> {t("onboarding.copyPassword")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInviteStaff} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {t("onboarding.inviteRole")}
                  </label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value)}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:ring-2 focus:ring-[#FF6A00] min-h-[44px]"
                  >
                    <option value="MANAGER">Manager (Full branch operations)</option>
                    <option value="WAITER">Waiter (Order taking & table service)</option>
                    <option value="CASHIER">Cashier (Billing & payment settlement)</option>
                    <option value="KITCHEN">Kitchen Display / Chef</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {t("onboarding.staffName")} *
                    </label>
                    <Input
                      type="text"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {t("onboarding.staffEmail")} *
                    </label>
                    <Input
                      type="email"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder="ramesh@myrestaurant.com"
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Staff Phone
                    </label>
                    <Input
                      type="tel"
                      value={staffPhone}
                      onChange={(e) => setStaffPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={invitingStaff || !staffName || !staffEmail}
                    className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
                  >
                    {invitingStaff ? "Adding Staff..." : "Create Staff Member"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 7: Ready / Done */}
      {currentStep === 6 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <CardTitle>{t("onboarding.step7Title")}</CardTitle>
            </div>
            <CardDescription>{t("onboarding.step7Desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 mx-auto flex items-center justify-center">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h3 className="text-xl font-black text-foreground">
                {t("onboarding.doneAllSteps")}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                {t("onboarding.doneSummary")}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs font-semibold text-foreground">
                <span className="px-3 py-1 rounded-full bg-muted/60 border border-border">
                  {summaryStats.branches_count || 1} Branch
                </span>
                <span className="px-3 py-1 rounded-full bg-muted/60 border border-border">
                  {summaryStats.service_areas_count || 1} Service Area
                </span>
                <span className="px-3 py-1 rounded-full bg-muted/60 border border-border">
                  {summaryStats.tables_count || 0} Dining Seats
                </span>
                <span className="px-3 py-1 rounded-full bg-muted/60 border border-border">
                  {summaryStats.qr_codes_count || 0} QR Codes
                </span>
              </div>
            </div>

            {/* Checklist of 7 Steps */}
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {WIZARD_STEPS.map((s, idx) => (
                <div key={s.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 font-semibold text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Step {idx + 1}: {s.title}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-[11px]">Completed</span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="w-full sm:w-auto flex-1 bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
              >
                {t("onboarding.goToDashboard")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/qr")}
                className="w-full sm:w-auto flex-1 min-h-[44px]"
              >
                <Printer className="w-4 h-4 mr-2" />
                {t("onboarding.printQrStandees")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom Step Navigation Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        {currentStep > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="min-h-[44px] px-5"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("common.back")}
          </Button>
        ) : (
          <div />
        )}

        {currentStep < WIZARD_STEPS.length - 1 ? (
          <div className="flex items-center gap-3">
            {currentStep === 5 && !temporaryPassword && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCurrentStep(6)}
                className="text-xs text-muted-foreground min-h-[44px]"
              >
                {t("common.skip")}
              </Button>
            )}
            <Button
              type="button"
              onClick={handleNext}
              className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px] px-6"
            >
              {t("common.next")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
