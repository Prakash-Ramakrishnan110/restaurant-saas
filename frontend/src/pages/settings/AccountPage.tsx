import React, { useState, useEffect } from "react";
import { User, Mail, Phone, Sparkles, Building, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { useTranslation } from "react-i18next";

export const AccountPage: React.FC = () => {
  const { user, activeTenant, memberships } = useAuth();
  const { i18n } = useTranslation();

  const [fullName, setFullName] = useState<string>(user?.full_name || "");
  const [phoneNumber, setPhoneNumber] = useState<string>(user?.phone_number || "");
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setPhoneNumber(user.phone_number || "");
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await apiClient.patch("/auth/me/", {
        full_name: fullName,
        phone_number: phoneNumber,
      });
      setSuccessMsg("Profile updated successfully!");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageToggle = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <User className="h-6 w-6 text-[#FF6A00]" />
          Account & Plan
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Personal profile details, language preference, and organization plan details
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-md border border-emerald-300 dark:border-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 rounded-md border border-rose-300 dark:border-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-[#FF6A00]" />
              Personal Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="w-full pl-9 pr-3 py-2 bg-muted/50 border border-input rounded-md text-muted-foreground cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Email is used for sign-in and cannot be changed directly.
                </p>
              </div>

              <div>
                <label className="font-semibold block mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-card border border-input rounded-md focus:ring-2 focus:ring-[#FF6A00] outline-none min-h-[40px]"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-md focus:ring-2 focus:ring-[#FF6A00] outline-none min-h-[40px]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Interface Language</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={i18n.language.startsWith("en") ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleLanguageToggle("en")}
                    className={`flex-1 min-h-[36px] text-xs font-semibold ${
                      i18n.language.startsWith("en") ? "bg-[#0B1F3B] text-white" : ""
                    }`}
                  >
                    English
                  </Button>
                  <Button
                    type="button"
                    variant={i18n.language.startsWith("ta") ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleLanguageToggle("ta")}
                    className={`flex-1 min-h-[36px] text-xs font-semibold ${
                      i18n.language.startsWith("ta") ? "bg-[#0B1F3B] text-white" : ""
                    }`}
                  >
                    தமிழ் (Tamil)
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="w-full min-h-[44px] text-xs font-bold bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] mt-2"
              >
                {saving ? "Saving Changes..." : "Save Profile Details"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Plan & Restaurant Details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#FF6A00]" />
                Subscription Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="bg-muted/40 p-3 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-foreground">Standard Production Plan</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Unlimited Orders, Floor POS & Kitchen Bump Bars
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                  Active
                </span>
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex justify-between text-muted-foreground">
                  <span>Current Restaurant</span>
                  <span className="font-semibold text-foreground">
                    {activeTenant?.tenant_name || "ServeMyFood"}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Your Role</span>
                  <span className="font-semibold text-foreground">
                    {activeTenant?.role || "Owner"}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Active Outlets</span>
                  <span className="font-semibold text-foreground">1 Outlet Included</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4 text-[#FF6A00]" />
                Organizations & Memberships
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {memberships.map((m) => (
                <div
                  key={m.tenant_id}
                  className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card hover:bg-muted/30"
                >
                  <div>
                    <div className="font-bold text-foreground">{m.tenant_name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Role: {m.role}
                    </div>
                  </div>
                  {m.tenant_id === activeTenant?.tenant_id && (
                    <span className="text-[11px] font-bold text-[#C2410C]">Current</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
