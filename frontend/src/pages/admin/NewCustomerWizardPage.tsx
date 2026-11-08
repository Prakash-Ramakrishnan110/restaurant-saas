import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
  PlusCircle,
  UtensilsCrossed,
  Coffee,
  Zap,
  Store,
  Building,
  Crown,
  Eye,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";

interface CustomerForm {
  name: string;
  business_type: string;
  city: string;
  language: "en" | "ta";
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  initial_password?: string;
  plan_slug: "starter" | "professional" | "business" | "enterprise";
  trial_days: number;
  outlets_count: number;
  outlet_names: string[];
}

interface ProvisionResult {
  tenant_id: string;
  name: string;
  owner_email: string;
  temporary_password: string;
  welcome_note: string;
}

export const NewCustomerWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPwd, setCopiedPwd] = useState<boolean>(false);
  const [copiedNote, setCopiedNote] = useState<boolean>(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);

  const [form, setForm] = useState<CustomerForm>({
    name: "",
    business_type: "RESTAURANT",
    city: "",
    language: "en",
    owner_name: "",
    owner_phone: "",
    owner_email: "",
    initial_password: "",
    plan_slug: "starter",
    trial_days: 14,
    outlets_count: 1,
    outlet_names: [""],
  });

  const getBusinessTypeColor = (type?: string) => {
    switch (type) {
      case "RESTAURANT":
        return "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/50 dark:text-orange-200 dark:border-orange-800";
      case "CAFE":
        return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800";
      case "TEA_SHOP":
        return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800";
      case "HOTEL":
        return "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800";
      case "BAKERY":
        return "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800";
      case "FOOD_COURT":
        return "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800";
      case "FINE_DINING":
        return "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800";
      default:
        return "bg-gray-100 text-gray-900 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700";
    }
  };

  const BUSINESS_TYPES = [
    {
      id: "RESTAURANT",
      label: "Restaurant",
      pill: "Full Table POS",
      desc: "Full table service, table merging, and multi-course kitchen routing",
      icon: UtensilsCrossed,
    },
    {
      id: "CAFE",
      label: "Café",
      pill: "Tables + Counter",
      desc: "Casual dining tables, pastry takeaway counters, and token numbers",
      icon: Coffee,
    },
    {
      id: "TEA_SHOP",
      label: "Tea Shop",
      pill: "Token Queue",
      desc: "High-speed token numbers, counter pickup, zero table clutter",
      icon: Zap,
    },
    {
      id: "BAKERY",
      label: "Bakery",
      pill: "Counter Ordering",
      desc: "Takeaway counters, pastry cases, and token pickup queue",
      icon: Store,
    },
    {
      id: "HOTEL",
      label: "Hotel",
      pill: "Rooms + Outlets",
      desc: "Multi-floor rooms, guest folios, and 24/7 room service dining",
      icon: Building,
    },
    {
      id: "FOOD_COURT",
      label: "Food Court",
      pill: "Counter Buzzer",
      desc: "Multi-stall counter pickup, shared food court dining, buzzer queue",
      icon: Store,
    },
    {
      id: "FINE_DINING",
      label: "Fine Dining",
      pill: "VIP & Multi-Course",
      desc: "Multi-course reservations, sommelier, and VIP floor sections",
      icon: Crown,
    },
  ];

  const PLANS = [
    {
      id: "starter" as const,
      name: "Starter",
      price: "₹1,499 / mo",
      details: "1 outlet • Up to 10 tables • Basic daily reporting",
    },
    {
      id: "professional" as const,
      name: "Professional",
      price: "₹4,999 / mo",
      details: "Up to 5 outlets • 50 tables • Kitchen KDS & visual floor plan",
      popular: true,
    },
    {
      id: "business" as const,
      name: "Business",
      price: "₹9,999 / mo",
      details: "Up to 15 outlets • 150 tables • Multi-store controls",
    },
    {
      id: "enterprise" as const,
      name: "Enterprise",
      price: "₹24,999 / mo",
      details: "Unlimited outlets & tables • Custom integrations & SLA",
    },
  ];

  const STEPS = [
    { step: 1, label: "Business Model" },
    { step: 2, label: "Owner Account" },
    { step: 3, label: "Plan & Trial" },
    { step: 4, label: "Branches / Outlets" },
    { step: 5, label: "Review & Provision" },
  ];

  const handleNext = () => {
    setErrorMessage(null);
    if (currentStep === 1) {
      if (!form.name.trim()) {
        setErrorMessage("Please enter the restaurant or business name.");
        return;
      }
    } else if (currentStep === 2) {
      if (!form.owner_name.trim() || !form.owner_email.trim()) {
        setErrorMessage("Owner full name and a valid login email are required.");
        return;
      }
    }
    setCurrentStep((prev) => Math.min(5, prev + 1));
  };

  const handleBack = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const payload = {
        name: form.name.trim(),
        business_type: form.business_type,
        city: form.city.trim(),
        language: form.language,
        owner_name: form.owner_name.trim(),
        owner_phone: form.owner_phone.trim(),
        owner_email: form.owner_email.trim().toLowerCase(),
        initial_password: form.initial_password?.trim() || undefined,
        plan_slug: form.plan_slug,
        trial_days: Number(form.trial_days) || 14,
        outlets_count: Number(form.outlets_count) || 1,
        outlet_names: form.outlet_names.filter((n) => n.trim().length > 0),
      };

      const res = await apiClient.post<ProvisionResult>("/platform/customers/", payload);
      setResult(res.data);
      setCurrentStep(6);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, string[]> }; message?: string };
      const details = axiosErr.response?.data;
      if (details) {
        const firstKey = Object.keys(details)[0];
        const msg = Array.isArray(details[firstKey])
          ? details[firstKey][0]
          : String(details[firstKey]);
        setErrorMessage(`${firstKey}: ${msg}`);
      } else {
        setErrorMessage(axiosErr.message || "Failed to provision customer account.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, type: "pwd" | "note") => {
    navigator.clipboard.writeText(text);
    if (type === "pwd") {
      setCopiedPwd(true);
      setTimeout(() => setCopiedPwd(false), 2000);
    } else {
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 2000);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header & Quick Actions matching Tenants Directory */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
            Tenants Management
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground mt-0.5 flex items-center gap-2">
            <PlusCircle className="h-7 w-7 text-[#FF6A00]" /> New Customer Provisioning
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Provision a new restaurant tenant, initial outlets, venue presets, and administrator credentials.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/admin/tenants")}
            className="text-xs gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Tenants Directory</span>
          </Button>

          <Badge variant="outline" className="text-xs px-3 py-1 font-bold bg-muted/40">
            {user?.email || "admin@fusionengine.in"}
          </Badge>
        </div>
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-xs font-semibold text-destructive flex items-center justify-between shadow-xs">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="font-bold hover:opacity-75 p-1 text-sm leading-none"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Wizard Card Container matching Tenants Directory */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Card Header Bar with Segmented Step Navigation */}
        {currentStep <= 5 && (
          <div className="p-4 border-b border-border bg-muted/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-[#FF6A00] uppercase tracking-wider">
                  Step {currentStep} of 5
                </span>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mt-0.5">
                  {currentStep === 1 && "Business Information & Operational Preset"}
                  {currentStep === 2 && "Owner Account & Authentication"}
                  {currentStep === 3 && "Subscription Plan & Trial Duration"}
                  {currentStep === 4 && "Branches & Outlets Configuration"}
                  {currentStep === 5 && "Review & Confirm Provisioning"}
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                All fields marked with * are required
              </span>
            </div>

            {/* Segmented Step Navigation Bar */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-background border border-border rounded-lg">
              {STEPS.map((s) => {
                const isCurrent = currentStep === s.step;
                const isCompleted = currentStep > s.step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => {
                      if (isCompleted || s.step < currentStep) {
                        setErrorMessage(null);
                        setCurrentStep(s.step);
                      }
                    }}
                    disabled={!isCompleted && !isCurrent}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isCurrent
                        ? "bg-[#FF6A00] text-white shadow-xs"
                        : isCompleted
                          ? "text-emerald-700 dark:text-emerald-300 hover:bg-muted cursor-pointer"
                          : "text-muted-foreground/60 cursor-not-allowed"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
                        isCurrent
                          ? "bg-white text-[#FF6A00]"
                          : isCompleted
                            ? "bg-emerald-600 text-white"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? "✓" : s.step}
                    </span>
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1: Business Information & Venue Preset */}
        {currentStep === 1 && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Business / Restaurant Name *
                </label>
                <Input
                  placeholder="e.g. Sangeetha Veg Restaurant, Madurai Cafe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 text-sm font-medium"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Operating City / Headquarters
                </label>
                <Input
                  placeholder="e.g. Chennai, Bengaluru, Coimbatore"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="h-10 text-sm font-medium"
                />
              </div>
            </div>

            {/* Operating Model & Workflow Preset */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-foreground">
                  Operating Model &amp; Workflow Preset *
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Shapes table layout, POS tickets, and kitchen routing
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {BUSINESS_TYPES.map((bt) => {
                  const isSelected = form.business_type === bt.id;
                  const Icon = bt.icon;
                  return (
                    <div
                      key={bt.id}
                      onClick={() => setForm({ ...form, business_type: bt.id })}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-[#FF6A00] bg-[#FF6A00]/5 ring-2 ring-[#FF6A00]/40 shadow-xs"
                          : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${isSelected ? "text-[#FF6A00]" : "text-muted-foreground"}`} />
                            <span className="text-xs font-black text-foreground">
                              {bt.label}
                            </span>
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${getBusinessTypeColor(
                              bt.id
                            )}`}
                          >
                            {bt.pill}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {bt.desc}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground font-mono">preset: {bt.id}</span>
                        {isSelected && (
                          <span className="text-[#FF6A00] font-bold flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> Selected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Document Language */}
            <div className="pt-2 border-t border-border">
              <label className="block text-xs font-bold text-foreground mb-2">
                Document Language (Invoices, Receipts &amp; Public QR)
              </label>
              <div className="flex flex-wrap gap-4">
                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                  form.language === "en"
                    ? "border-[#FF6A00] bg-[#FF6A00]/5 ring-1 ring-[#FF6A00]"
                    : "border-border bg-card hover:bg-muted/40"
                }`}>
                  <input
                    type="radio"
                    name="lang"
                    checked={form.language === "en"}
                    onChange={() => setForm({ ...form, language: "en" })}
                    className="accent-[#FF6A00]"
                  />
                  <span>English (Default Standard)</span>
                </label>

                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                  form.language === "ta"
                    ? "border-[#FF6A00] bg-[#FF6A00]/5 ring-1 ring-[#FF6A00]"
                    : "border-border bg-card hover:bg-muted/40"
                }`}>
                  <input
                    type="radio"
                    name="lang"
                    checked={form.language === "ta"}
                    onChange={() => setForm({ ...form, language: "ta" })}
                    className="accent-[#FF6A00]"
                  />
                  <span>English &amp; Tamil Bilingual (இருமொழி)</span>
                </label>
              </div>
            </div>

            {/* Step 1 Actions */}
            <div className="pt-4 border-t border-border flex justify-end">
              <Button onClick={handleNext} className="gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white font-bold text-xs">
                <span>Continue to Owner Account</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Owner Contact Details */}
        {currentStep === 2 && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Owner Full Name *
                </label>
                <Input
                  placeholder="e.g. Ramesh Kumar"
                  value={form.owner_name}
                  onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                  className="h-10 text-sm font-medium"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Owner Email Address (Login ID) *
                </label>
                <Input
                  type="email"
                  placeholder="owner@restaurant.com"
                  value={form.owner_email}
                  onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                  className="h-10 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Owner Phone Number
                </label>
                <Input
                  placeholder="+91 98765 43210"
                  value={form.owner_phone}
                  onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
                  className="h-10 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Initial Password (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="Leave empty to auto-generate secure 12-char password"
                  value={form.initial_password || ""}
                  onChange={(e) => setForm({ ...form, initial_password: e.target.value })}
                  className="h-10 text-sm font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  If left blank, the platform automatically generates a cryptographically secure credential.
                </p>
              </div>
            </div>

            {/* Step 2 Actions */}
            <div className="pt-4 border-t border-border flex justify-between">
              <Button variant="outline" onClick={handleBack} className="gap-2 text-xs">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext} className="gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white font-bold text-xs">
                <span>Continue to Subscription Plan</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Subscription Plan & Trial */}
        {currentStep === 3 && (
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-foreground">
                  Select Subscription Plan Tier *
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Quotas and feature flags apply immediately upon provisioning
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {PLANS.map((p) => {
                  const isSelected = form.plan_slug === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setForm({ ...form, plan_slug: p.id })}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-[#FF6A00] bg-[#FF6A00]/5 ring-2 ring-[#FF6A00]/40 shadow-xs"
                          : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-extrabold text-sm text-foreground">
                            {p.name}
                          </span>
                          {p.popular && (
                            <Badge className="bg-[#FF6A00] text-white text-[9px] px-1.5 py-0 font-bold uppercase">
                              Popular
                            </Badge>
                          )}
                        </div>
                        <span className="text-base font-black text-foreground block">
                          {p.price}
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                          {p.details}
                        </p>
                      </div>

                      <div className="mt-4 pt-2.5 border-t border-border/50 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                          Tier: {p.id}
                        </span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? "border-[#FF6A00] bg-[#FF6A00]" : "border-muted-foreground/40"
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trial Duration */}
            <div className="pt-2 border-t border-border">
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Trial Duration (Days)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={form.trial_days}
                  onChange={(e) => setForm({ ...form, trial_days: Number(e.target.value) || 14 })}
                  className="h-10 text-sm font-bold max-w-[140px]"
                />
                <div className="flex items-center gap-1.5">
                  {[14, 30, 60].map((days) => (
                    <Button
                      key={days}
                      type="button"
                      size="sm"
                      variant={form.trial_days === days ? "default" : "outline"}
                      onClick={() => setForm({ ...form, trial_days: days })}
                      className={`text-xs h-9 ${form.trial_days === days ? "bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white font-bold" : ""}`}
                    >
                      {days} Days
                    </Button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Default: 14 days free trial. The account remains fully functional until converted or billed.
              </p>
            </div>

            {/* Step 3 Actions */}
            <div className="pt-4 border-t border-border flex justify-between">
              <Button variant="outline" onClick={handleBack} className="gap-2 text-xs">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext} className="gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white font-bold text-xs">
                <span>Continue to Outlets</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Outlets & Branches */}
        {currentStep === 4 && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Number of Outlets to Provision *
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={form.outlets_count}
                    onChange={(e) => {
                      const cnt = Math.max(1, Number(e.target.value) || 1);
                      const names = [...form.outlet_names];
                      while (names.length < cnt) names.push("");
                      setForm({ ...form, outlets_count: cnt, outlet_names: names.slice(0, cnt) });
                    }}
                    className="h-10 text-sm font-bold max-w-[120px]"
                  />
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 5].map((num) => (
                      <Button
                        key={num}
                        type="button"
                        size="sm"
                        variant={form.outlets_count === num ? "default" : "outline"}
                        onClick={() => {
                          const names = [...form.outlet_names];
                          while (names.length < num) names.push("");
                          setForm({ ...form, outlets_count: num, outlet_names: names.slice(0, num) });
                        }}
                        className={`text-xs h-9 ${form.outlets_count === num ? "bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white font-bold" : ""}`}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Each outlet receives independent physical floor layouts and billing terminals.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-2">
                Outlet Names (Optional Custom Labels)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Array.from({ length: form.outlets_count }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-16 shrink-0">
                      Outlet {idx + 1}:
                    </span>
                    <Input
                      placeholder={`e.g. ${form.name || "Main Outlet"} - Branch ${idx + 1}`}
                      value={form.outlet_names[idx] || ""}
                      onChange={(e) => {
                        const newNames = [...form.outlet_names];
                        newNames[idx] = e.target.value;
                        setForm({ ...form, outlet_names: newNames });
                      }}
                      className="h-9 text-xs font-medium"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4 Actions */}
            <div className="pt-4 border-t border-border flex justify-between">
              <Button variant="outline" onClick={handleBack} className="gap-2 text-xs">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext} className="gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white font-bold text-xs">
                <span>Review Configuration</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Review & Confirm Provisioning */}
        {currentStep === 5 && (
          <div className="p-6 space-y-6">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border uppercase tracking-wider font-bold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Configuration Parameter</th>
                    <th className="py-3 px-4">Selected Value</th>
                    <th className="py-3 px-4">Platform Badge / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-bold text-foreground">Brand / Entity Name</td>
                    <td className="py-3 px-4 font-extrabold text-foreground">{form.name}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${getBusinessTypeColor(form.business_type)}`}>
                        {form.business_type}
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-bold text-foreground">Headquarters &amp; Language</td>
                    <td className="py-3 px-4 text-foreground font-semibold">{form.city || "Not specified"}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {form.language === "ta" ? "English + Tamil (Bilingual)" : "English (Standard)"}
                      </Badge>
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-bold text-foreground">Owner Account</td>
                    <td className="py-3 px-4 text-foreground font-bold">{form.owner_name}</td>
                    <td className="py-3 px-4 text-muted-foreground font-mono">
                      {form.owner_email} {form.owner_phone ? `• ${form.owner_phone}` : ""}
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-bold text-foreground">Subscription Tier</td>
                    <td className="py-3 px-4 text-foreground font-extrabold capitalize">{form.plan_slug} Plan</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] bg-muted/40 font-bold text-[#FF6A00]">
                        {form.trial_days} Days Free Trial
                      </Badge>
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-bold text-foreground">Outlets to Provision</td>
                    <td className="py-3 px-4 text-foreground font-extrabold">{form.outlets_count} Outlet(s)</td>
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {form.outlet_names.filter((n) => n.trim().length > 0).join(", ") || "Default Main Branch"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                On provisioning, an isolated tenant container, default branch, layout presets, and
                owner account will be created. A single-use temporary password will be presented.
              </span>
            </div>

            {/* Step 5 Actions */}
            <div className="pt-4 border-t border-border flex justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={submitting}
                className="gap-2 text-xs"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                {submitting ? "Provisioning..." : "Provision Customer Account"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Customer Account Provisioned Successfully */}
        {currentStep === 6 && result && (
          <div className="p-6 md:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-black font-heading text-foreground">
                Customer Account Provisioned Successfully!
              </h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                <strong className="text-foreground">{result.name}</strong> has been created with
                active trial credentials.
              </p>
            </div>

            {/* Temporary Password Box */}
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                  Single-Use Temporary Password (Shown Once)
                </span>
                <Badge variant="outline" className="border-amber-500/40 text-[10px]">
                  Must change on login
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 font-mono text-base font-black text-foreground bg-card p-2.5 rounded-lg border border-border select-all">
                  {result.temporary_password}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(result.temporary_password, "pwd")}
                  className="gap-1.5 text-xs"
                >
                  {copiedPwd ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copiedPwd ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300">
                ⚠️ This password is not stored anywhere in plain text. Please copy and deliver it to
                the owner now.
              </p>
            </div>

            {/* Welcome Note */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">
                  Ready-to-Send Welcome Note
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(result.welcome_note, "note")}
                  className="h-7 text-xs gap-1 text-[#FF6A00]"
                >
                  {copiedNote ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedNote ? "Copied note" : "Copy full message"}
                </Button>
              </div>
              <textarea
                readOnly
                rows={7}
                value={result.welcome_note}
                className="w-full text-xs font-mono p-3 rounded-xl border border-border bg-muted/30 text-foreground resize-none"
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin/tenants")}
                className="text-xs gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Tenants Directory</span>
              </Button>
              <Button
                size="sm"
                onClick={() => navigate(`/admin/tenants/${result.tenant_id}`)}
                className="gap-1.5 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white font-bold text-xs"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Inspect New Tenant</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
