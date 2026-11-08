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
    plan_slug: "starter",
    trial_days: 14,
    outlets_count: 1,
    outlet_names: [""],
  });

  const BUSINESS_TYPES = [
    { id: "TEA_SHOP", label: "Tea Shop", desc: "Fast token queue, counters, zero tables" },
    { id: "BAKERY", label: "Bakery", desc: "Takeaway counters, token numbers" },
    { id: "CAFE", label: "Café", desc: "Casual dining tables and counter ordering" },
    { id: "RESTAURANT", label: "Restaurant", desc: "Full table service, kitchen routing" },
    { id: "FINE_DINING", label: "Fine Dining", desc: "Multi-course service and VIP sections" },
    { id: "HOTEL", label: "Hotel", desc: "Floors, outlets, rooms, and room service" },
    { id: "FOOD_COURT", label: "Food Court", desc: "Multi-stall counter pickup" },
  ];

  const PLANS = [
    {
      id: "starter" as const,
      name: "Starter",
      price: "₹1,499 / mo",
      details: "1 outlet, up to 10 tables, basic reporting",
    },
    {
      id: "professional" as const,
      name: "Professional",
      price: "₹4,999 / mo",
      details: "Up to 5 outlets, 50 tables, kitchen KDS & floor plan",
    },
    {
      id: "business" as const,
      name: "Business",
      price: "₹9,999 / mo",
      details: "Up to 15 outlets, 150 tables, multi-store controls",
    },
    {
      id: "enterprise" as const,
      name: "Enterprise",
      price: "₹24,999 / mo",
      details: "Unlimited outlets, custom integrations & SLA",
    },
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
        setErrorMessage("Owner name and a valid email are required.");
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
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
            Platform Operator Wizard
          </span>
          <h1 className="text-2xl font-extrabold font-heading text-foreground mt-0.5 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[#FF6A00]" />
            New Customer Onboarding
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Provision a new restaurant tenant, initial outlets, venue presets, and owner
            credentials.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/tenants")}>
          Cancel
        </Button>
      </div>

      {/* Step Indicators */}
      {currentStep <= 5 && (
        <div className="flex items-center justify-between px-2 text-xs font-bold text-muted-foreground">
          {[
            { step: 1, label: "Business" },
            { step: 2, label: "Owner" },
            { step: 3, label: "Plan & Trial" },
            { step: 4, label: "Outlets" },
            { step: 5, label: "Review" },
          ].map((s) => (
            <div
              key={s.step}
              className={`flex items-center gap-1.5 ${
                currentStep === s.step
                  ? "text-[#FF6A00]"
                  : currentStep > s.step
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground/60"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                  currentStep === s.step
                    ? "bg-[#FF6A00] text-white"
                    : currentStep > s.step
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > s.step ? "✓" : s.step}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs font-semibold text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Step 1: Business */}
      {currentStep === 1 && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Step 1: Business Information
              </h2>
              <p className="text-xs text-muted-foreground">
                Set the restaurant name, city, and business operational model.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Business / Restaurant Name *
                </label>
                <Input
                  placeholder="e.g. Anand Bhavan, Chai Katta"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Operating City / Location
                </label>
                <Input
                  placeholder="e.g. Chennai, Coimbatore, Bengaluru"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="h-10 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Business Model & Venue Preset *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {BUSINESS_TYPES.map((bt) => {
                    const isSelected = form.business_type === bt.id;
                    return (
                      <div
                        key={bt.id}
                        onClick={() => setForm({ ...form, business_type: bt.id })}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                          isSelected
                            ? "border-[#FF6A00] bg-[#FF6A00]/5 ring-1 ring-[#FF6A00]"
                            : "border-border bg-card hover:border-border/80"
                        }`}
                      >
                        <span className="text-xs font-extrabold text-foreground block">
                          {bt.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{bt.desc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Document Language (Receipts & QR)
                </label>
                <div className="flex gap-4">
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
                    English & Tamil (இருமொழி)
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button onClick={handleNext} className="gap-2">
                Continue to Owner <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Owner */}
      {currentStep === 2 && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Step 2: Owner Contact Details
              </h2>
              <p className="text-xs text-muted-foreground">
                The primary owner account that receives management credentials.
              </p>
            </div>

            <div className="space-y-4">
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
                  Owner Email Address (Login ID) *
                </label>
                <Input
                  type="email"
                  placeholder="owner@restaurant.com"
                  value={form.owner_email}
                  onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                  className="h-10 text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  The initial login password will be generated and shown once on completion.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Owner Phone Number
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
              <Button variant="outline" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext} className="gap-2">
                Continue to Plan <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Plan and Trial */}
      {currentStep === 3 && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Step 3: Plan & Trial Duration
              </h2>
              <p className="text-xs text-muted-foreground">
                Select one of the strictly supported SaaS subscription plans.
              </p>
            </div>

            <div className="space-y-3">
              {PLANS.map((p) => {
                const isSelected = form.plan_slug === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setForm({ ...form, plan_slug: p.id })}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? "border-[#FF6A00] bg-[#FF6A00]/5 ring-1 ring-[#FF6A00]"
                        : "border-border bg-card hover:border-border/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-foreground">{p.name}</span>
                        <Badge variant="outline" className="text-[10px] py-0">
                          {p.price}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.details}</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? "border-[#FF6A00] bg-[#FF6A00]" : "border-muted-foreground/40"
                      }`}
                    >
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Trial Duration (Days)
              </label>
              <Input
                type="number"
                min={1}
                max={90}
                value={form.trial_days}
                onChange={(e) => setForm({ ...form, trial_days: Number(e.target.value) || 14 })}
                className="h-10 text-sm max-w-[200px]"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Default: 14 days. Trial ends without charging until manually converted or billed.
              </p>
            </div>

            <div className="pt-4 border-t border-border flex justify-between">
              <Button variant="outline" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext} className="gap-2">
                Continue to Outlets <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Outlets */}
      {currentStep === 4 && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Step 4: Outlets & Branches
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure physical or virtual outlet locations.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Number of Outlets to provision
                </label>
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
                  className="h-10 text-sm max-w-[200px]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-foreground">
                  Outlet Names (Optional custom names)
                </label>
                {Array.from({ length: form.outlets_count }).map((_, idx) => (
                  <Input
                    key={idx}
                    placeholder={`Outlet ${idx + 1} Name (e.g. ${
                      form.name || "Main"
                    } - Branch ${idx + 1})`}
                    value={form.outlet_names[idx] || ""}
                    onChange={(e) => {
                      const newNames = [...form.outlet_names];
                      newNames[idx] = e.target.value;
                      setForm({ ...form, outlet_names: newNames });
                    }}
                    className="h-9 text-xs"
                  />
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-between">
              <Button variant="outline" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext} className="gap-2">
                Review Setup <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review */}
      {currentStep === 5 && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Step 5: Review & Confirm Provisioning
              </h2>
              <p className="text-xs text-muted-foreground">
                Check all configuration parameters before creating the customer account.
              </p>
            </div>

            <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border text-xs divide-y divide-border">
              <div className="pb-2.5 flex justify-between">
                <span className="text-muted-foreground font-semibold">Business:</span>
                <span className="font-extrabold text-foreground">
                  {form.name} ({form.business_type})
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-muted-foreground font-semibold">City & Language:</span>
                <span className="font-bold text-foreground">
                  {form.city || "Not specified"} ·{" "}
                  {form.language === "ta" ? "English + Tamil" : "English"}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-muted-foreground font-semibold">Owner Contact:</span>
                <span className="font-bold text-foreground">
                  {form.owner_name} &lt;{form.owner_email}&gt; {form.owner_phone}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-muted-foreground font-semibold">Subscription Plan:</span>
                <span className="font-bold text-[#FF6A00] uppercase">
                  {form.plan_slug} ({form.trial_days} Days Free Trial)
                </span>
              </div>
              <div className="pt-2.5 flex justify-between">
                <span className="text-muted-foreground font-semibold">Outlets:</span>
                <span className="font-bold text-foreground">{form.outlets_count} outlet(s)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                On provisioning, an isolated tenant container, default branch, layout presets, and
                owner account will be created. A single-use temporary password will be presented.
              </span>
            </div>

            <div className="pt-4 border-t border-border flex justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={submitting}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? "Provisioning..." : "Provision Customer Account"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Done (Credentials) */}
      {currentStep === 6 && result && (
        <Card className="border border-emerald-500/40 bg-card shadow-lg">
          <CardContent className="p-6 md:p-8 space-y-6">
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
                  className="gap-1.5"
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
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/tenants")}>
                View All Tenants
              </Button>
              <Button
                size="sm"
                onClick={() => navigate(`/admin/tenants/${result.tenant_id}`)}
                className="gap-2"
              >
                Go to Customer Detail <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
