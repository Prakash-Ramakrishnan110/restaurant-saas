import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
  UtensilsCrossed,
  Coffee,
  Zap,
  Building,
  Store,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent } from "../../components/ui/card";
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
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPwd, setCopiedPwd] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
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
    outlet_names: ["Main Outlet"],
  });

  const BUSINESS_MODELS = [
    {
      id: "RESTAURANT",
      label: "Dining Restaurant",
      desc: "Full table service, table merging, and multi-course kitchen routing",
      icon: UtensilsCrossed,
      pill: "Full Table POS",
      color: "border-orange-200 dark:border-orange-900/40 bg-orange-50/20",
    },
    {
      id: "CAFE",
      label: "Café & Bakery",
      desc: "Casual dining tables, pastry takeaway counters, and token numbers",
      icon: Coffee,
      pill: "Tables + Counter",
      color: "border-amber-200 dark:border-amber-900/40 bg-amber-50/20",
    },
    {
      id: "TEA_SHOP",
      label: "Quick Service / Tea Shop",
      desc: "High-speed token numbers, counter pickup, zero table clutter",
      icon: Zap,
      pill: "Token Queue • Zero Tables",
      color: "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20",
    },
    {
      id: "HOTEL",
      label: "Hotel & Resort",
      desc: "Multi-floor rooms, guest folios, and 24/7 room service dining",
      icon: Building,
      pill: "Rooms + Outlets",
      color: "border-purple-200 dark:border-purple-900/40 bg-purple-50/20",
    },
    {
      id: "FOOD_COURT",
      label: "Food Court Stall",
      desc: "Multi-stall counter pickup, shared food court dining, buzzer queue",
      icon: Store,
      pill: "Counter Buzzer",
      color: "border-blue-200 dark:border-blue-900/40 bg-blue-50/20",
    },
  ];

  const PLANS = [
    {
      id: "starter" as const,
      name: "Starter",
      price: "₹1,499 / mo",
      details: "1 outlet • Up to 15 dining tables • Basic daily reports",
    },
    {
      id: "professional" as const,
      name: "Professional",
      price: "₹4,999 / mo",
      details: "Up to 3 outlets • 50 tables • Visual Floor Plan Editor & KDS",
      popular: true,
    },
    {
      id: "business" as const,
      name: "Business",
      price: "₹9,999 / mo",
      details: "Up to 10 outlets • 200 tables • Multi-course dining & multi-store controls",
    },
    {
      id: "enterprise" as const,
      name: "Enterprise",
      price: "₹24,999 / mo",
      details: "Unlimited outlets & tables • Custom integrations & dedicated SLA",
    },
  ];

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm({ ...form, initial_password: pwd });
    setShowPassword(true);
  };

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
      if (!form.owner_email.includes("@") || !form.owner_email.includes(".")) {
        setErrorMessage("Please enter a valid owner email address.");
        return;
      }
    }
    setCurrentStep((prev) => Math.min(5, prev + 1));
  };

  const handleBack = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleOutletsCountChange = (count: number) => {
    const n = Math.max(1, Math.min(10, count));
    const names = [...form.outlet_names];
    while (names.length < n) {
      names.push(`Branch ${names.length + 1}`);
    }
    setForm({ ...form, outlets_count: n, outlet_names: names.slice(0, n) });
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
        setErrorMessage(axiosErr.message || "Failed to provision customer.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPwd(true);
    setTimeout(() => setCopiedPwd(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
            SaaS Onboarding Wizard
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground mt-0.5 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-[#FF6A00]" />
            New Customer Provisioning
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Provision a new restaurant tenant, initial outlets, venue presets, and administrator credentials.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/tenants")}>
          Cancel
        </Button>
      </div>

      {/* Stepper Progress Bar */}
      {currentStep <= 5 && (
        <div className="flex items-center justify-between px-2 text-xs font-bold">
          {[
            { step: 1, label: "Business Model" },
            { step: 2, label: "Owner Account" },
            { step: 3, label: "Plan & Trial" },
            { step: 4, label: "Branches / Outlets" },
            { step: 5, label: "Review & Provision" },
          ].map((s, idx, arr) => (
            <React.Fragment key={s.step}>
              <div
                className={`flex items-center gap-2 ${
                  currentStep === s.step
                    ? "text-[#FF6A00]"
                    : currentStep > s.step
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground/60"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    currentStep === s.step
                      ? "bg-[#FF6A00] text-white shadow-sm ring-2 ring-[#FF6A00]/30"
                      : currentStep > s.step
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > s.step ? "✓" : s.step}
                </span>
                <span className="hidden md:inline font-bold">{s.label}</span>
              </div>
              {idx < arr.length - 1 && (
                <div
                  className={`flex-1 mx-2 h-0.5 transition-colors ${
                    currentStep > s.step ? "bg-emerald-600" : "bg-muted"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs font-semibold text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Step 1: Business Profile */}
      {currentStep === 1 && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-black font-heading text-foreground">
                Step 1: Business &amp; Venue Model
              </h2>
              <p className="text-xs text-muted-foreground">
                Enter the brand name and select the operating preset that shapes the UI and workflows.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Business / Brand Name *
                  </label>
                  <Input
                    placeholder="e.g. Sangeetha Veg Restaurant, Madurai Cafe"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="h-10 text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Operating City / Headquarters
                  </label>
                  <Input
                    placeholder="e.g. Chennai, Bengaluru, Coimbatore"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-2">
                  Operating Model &amp; Workflow Preset *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BUSINESS_MODELS.map((bm) => {
                    const isSelected = form.business_type === bm.id;
                    const Icon = bm.icon;
                    return (
                      <div
                        key={bm.id}
                        onClick={() => setForm({ ...form, business_type: bm.id })}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                          isSelected
                            ? "border-[#FF6A00] bg-[#FF6A00]/5 ring-2 ring-[#FF6A00]/30 shadow-xs"
                            : "border-border bg-card hover:border-border/80"
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                            isSelected
                              ? "bg-[#FF6A00] text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-foreground">
                              {bm.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                            {bm.desc}
                          </p>
                          <Badge variant="outline" className="text-[10px] font-bold mt-2 bg-card">
                            {bm.pill}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Document Language (Invoices &amp; QR Guest Portal)
                </label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="lang"
                      checked={form.language === "en"}
                      onChange={() => setForm({ ...form, language: "en" })}
                    />
                    English Only
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="lang"
                      checked={form.language === "ta"}
                      onChange={() => setForm({ ...form, language: "ta" })}
                    />
                    Bilingual English &amp; Tamil (தமிழ்)
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button onClick={handleNext} className="gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-xs">
                Continue to Owner Account <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Owner Credentials */}
      {currentStep === 2 && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-black font-heading text-foreground">
                Step 2: Owner Contact &amp; Credentials
              </h2>
              <p className="text-xs text-muted-foreground">
                The primary owner account that receives management credentials to access the venue console.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Owner Full Name *
                  </label>
                  <Input
                    placeholder="e.g. Ramesh Kumar"
                    value={form.owner_name}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    className="h-10 text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Owner Email (Platform Login ID) *
                  </label>
                  <Input
                    type="email"
                    placeholder="e.g. ramesh@restaurant.com"
                    value={form.owner_email}
                    onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                    className="h-10 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-foreground">
                    Initial Password
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-xs text-[#FF6A00] hover:underline font-bold flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" /> Generate Strong Password
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter custom password or click Generate above (leave blank to auto-generate)"
                    value={form.initial_password || ""}
                    onChange={(e) => setForm({ ...form, initial_password: e.target.value })}
                    className="h-10 text-sm font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  The owner will use this password to log in. You can also view it on the final screen.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Owner Mobile Number (Optional)
                </label>
                <Input
                  placeholder="+91 98765 43210"
                  value={form.owner_phone}
                  onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-between">
              <Button variant="outline" onClick={handleBack} className="gap-2 text-xs">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext} className="gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-xs">
                Continue to Plan <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Plan & Trial */}
      {currentStep === 3 && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-black font-heading text-foreground">
                Step 3: Subscription Tier &amp; Trial Period
              </h2>
              <p className="text-xs text-muted-foreground">
                Select the subscription tier and trial window for this brand.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLANS.map((p) => {
                  const isSelected = form.plan_slug === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setForm({ ...form, plan_slug: p.id })}
                      className={`relative p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#FF6A00] bg-[#FF6A00]/5 ring-2 ring-[#FF6A00]/30 shadow-xs"
                          : "border-border bg-card hover:border-border/80"
                      }`}
                    >
                      {p.popular && (
                        <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF6A00] text-white uppercase">
                          Recommended
                        </span>
                      )}
                      <h3 className="font-extrabold text-sm text-foreground">{p.name}</h3>
                      <div className="text-xl font-black text-foreground mt-1">
                        {p.price}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">{p.details}</p>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Complimentary Trial Period
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { days: 7, label: "7 Days Quick Trial" },
                    { days: 14, label: "14 Days (Standard)" },
                    { days: 30, label: "30 Days (Extended)" },
                  ].map((t) => (
                    <button
                      key={t.days}
                      type="button"
                      onClick={() => setForm({ ...form, trial_days: t.days })}
                      className={`p-3 rounded-lg border text-xs font-bold transition-all text-center ${
                        form.trial_days === t.days
                          ? "border-[#FF6A00] bg-[#FF6A00]/10 text-foreground ring-1 ring-[#FF6A00]"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-between">
              <Button variant="outline" onClick={handleBack} className="gap-2 text-xs">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext} className="gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-xs">
                Continue to Outlets <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Outlets & Branches */}
      {currentStep === 4 && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-black font-heading text-foreground">
                Step 4: Outlets &amp; Branch Locations
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure initial outlets to seed for this brand.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Number of Initial Outlets (1 to 10)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleOutletsCountChange(cnt)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
                        form.outlets_count === cnt
                          ? "border-[#FF6A00] bg-[#FF6A00] text-white"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cnt} {cnt === 1 ? "Outlet" : "Outlets"}
                    </button>
                  ))}
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={form.outlets_count}
                    onChange={(e) => handleOutletsCountChange(Number(e.target.value))}
                    className="w-20 h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-foreground">
                  Outlet Names
                </label>
                {form.outlet_names.map((name, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono w-6 text-right">
                      #{i + 1}
                    </span>
                    <Input
                      placeholder={`Outlet ${i + 1} Name`}
                      value={name}
                      onChange={(e) => {
                        const updated = [...form.outlet_names];
                        updated[i] = e.target.value;
                        setForm({ ...form, outlet_names: updated });
                      }}
                      className="h-9 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-between">
              <Button variant="outline" onClick={handleBack} className="gap-2 text-xs">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext} className="gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-xs">
                Review &amp; Provision <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review & Provision */}
      {currentStep === 5 && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-black font-heading text-foreground">
                Step 5: Review Selections &amp; Provision
              </h2>
              <p className="text-xs text-muted-foreground">
                Confirm customer details before generating the tenant database partition and owner account.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Brand Name:</span>
                  <span className="font-extrabold text-foreground text-sm">{form.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Venue Preset:</span>
                  <span className="font-bold text-foreground">{form.business_type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Operating City:</span>
                  <span className="font-bold text-foreground">{form.city || "Not specified"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Language:</span>
                  <span className="font-bold text-foreground">
                    {form.language === "en" ? "English" : "English & Tamil"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Owner Name:</span>
                  <span className="font-bold text-foreground">{form.owner_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Owner Login ID:</span>
                  <span className="font-mono font-bold text-foreground">{form.owner_email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Password:</span>
                  <span className="font-mono font-bold text-foreground">
                    {form.initial_password ? form.initial_password : "Auto-generate 12-char password"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Owner Phone:</span>
                  <span className="font-mono text-foreground">{form.owner_phone || "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Subscription Plan:</span>
                  <span className="font-bold text-[#FF6A00] uppercase">{form.plan_slug}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Trial Duration:</span>
                  <span className="font-bold text-emerald-600">{form.trial_days} Days Complimentary</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[11px]">Initial Outlets:</span>
                  <span className="font-bold text-foreground">
                    {form.outlet_names.filter((n) => n.trim().length > 0).join(", ")}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-between">
              <Button variant="outline" onClick={handleBack} disabled={submitting} className="gap-2 text-xs">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white font-extrabold text-xs px-6"
              >
                {submitting ? "Provisioning Brand..." : "Confirm & Provision Customer"}
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Provisioned Success Screen */}
      {currentStep === 6 && result && (
        <Card className="border border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/20">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-emerald-600 text-white shadow-sm">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black font-heading text-foreground">
                  Customer Successfully Provisioned!
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tenant partition and owner administrator account are live and ready for operation.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-3 text-xs">
              <h3 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                Owner Credentials
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <span className="text-[10px] text-muted-foreground block">Login Email ID</span>
                  <span className="font-mono font-bold text-foreground text-sm block mt-0.5">
                    {result.owner_email}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Temporary Password</span>
                    <span className="font-mono font-bold text-foreground text-sm block mt-0.5">
                      {result.temporary_password}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(result.temporary_password)}
                    className="h-8 text-xs gap-1"
                  >
                    {copiedPwd ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedPwd ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin/tenants")}
                className="text-xs"
              >
                Back to Tenants Directory
              </Button>
              <Button
                size="sm"
                onClick={() => navigate(`/admin/tenants/${result.tenant_id}`)}
                className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-xs gap-1.5"
              >
                <span>Inspect New Tenant</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
