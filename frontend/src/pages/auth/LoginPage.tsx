import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Utensils, ShieldCheck, Zap, Globe, Sparkles } from "lucide-react";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { RateLimitCountdown } from "../../components/app/RateLimitCountdown";

export const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await login(email, password);
      if (res?.mustChangePassword) {
        navigate("/change-password");
      } else {
        const from = (location.state as any)?.from?.pathname || "/dashboard";
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      if (err?.error?.code === "RATE_LIMITED") {
        const retryAfter = Number(err?.error?.details?.retry_after) || 60;
        setRateLimitSeconds(retryAfter);
      }
      const msg =
        err?.error?.message ||
        err?.message ||
        "Invalid email or password. Please verify your credentials.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLanguageToggle = () => {
    const nextLang = (i18n.language || "en").startsWith("ta") ? "en" : "ta";
    i18n.changeLanguage(nextLang);
  };

  const prefill = (demoEmail: string, demoPass: string = "Password123!") => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Desktop Left Brand Hero Panel (Warm Cream #FFF3E0) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#FFF3E0] dark:bg-[#0B1F3B] p-12 flex-col justify-between border-r border-orange-200 dark:border-navy-800 relative overflow-hidden">
        {/* Subtle decorative cloche background glow */}
        <div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full bg-[#FF6A00]/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-[#FF6A00]/5 blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <BrandLogo size={44} theme={theme === "dark" ? "dark" : "light"} />
          <div className="mt-16 max-w-md">
            <h1 className="text-4xl font-extrabold tracking-tight text-[#0B1F3B] dark:text-white leading-tight font-display">
              {t("brand.tagline")}
            </h1>
            <p className="mt-4 text-base text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
              Streamline floor plans, table sessions, QR ordering, and kitchen workflows from a
              single unified operating platform.
            </p>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="relative z-10 space-y-4 my-8 max-w-md">
          <div className="flex items-center gap-3.5 p-3 rounded-lg bg-white/70 dark:bg-white/5 border border-orange-100 dark:border-gray-800 shadow-sm">
            <div className="w-9 h-9 rounded-md bg-[#FF6A00] flex items-center justify-center text-[#0B1F3B] shrink-0 font-bold">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#0B1F3B] dark:text-white">
                Floor & Table Management
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Dynamic table grouping, join/split, and real-time status tracking.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3 rounded-lg bg-white/70 dark:bg-white/5 border border-orange-100 dark:border-gray-800 shadow-sm">
            <div className="w-9 h-9 rounded-md bg-[#FF6A00] flex items-center justify-center text-[#0B1F3B] shrink-0 font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#0B1F3B] dark:text-white">
                QR Ordering & Tokens
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Customer contactless ordering and race-free daily token counters.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3 rounded-lg bg-white/70 dark:bg-white/5 border border-orange-100 dark:border-gray-800 shadow-sm">
            <div className="w-9 h-9 rounded-md bg-[#FF6A00] flex items-center justify-center text-[#0B1F3B] shrink-0 font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#0B1F3B] dark:text-white">
                Strict Multi-Tenant Security
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Row-level database tenant isolation with audited RBAC permissions.
              </div>
            </div>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="relative z-10 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 font-sans">
          <span>ServeMyFood v0.3.0</span>
          <span>© 2026 {t("brand.company")}</span>
        </div>
      </div>

      {/* Right Column: Form Container */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12">
        {/* Top bar with language & theme toggles */}
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <BrandLogo size={32} theme={theme === "dark" ? "dark" : "light"} />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleLanguageToggle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-muted transition-colors"
              title="Switch language (EN / Tamil)"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{(i18n.language || "en").startsWith("ta") ? "English" : "தமிழ்"}</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 rounded-md border text-xs hover:bg-muted transition-colors"
              title="Toggle theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </div>

        {/* Center: Sign In Card */}
        <div className="max-w-md w-full mx-auto my-8">
          <Card className="border shadow-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold font-display text-[#0B1F3B] dark:text-white">
                {t("auth.signIn")}
              </CardTitle>
              <CardDescription>{t("auth.signInDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {rateLimitSeconds && (
                <div className="mb-4">
                  <RateLimitCountdown
                    initialWaitSeconds={rateLimitSeconds}
                    onFinished={() => setRateLimitSeconds(null)}
                  />
                </div>
              )}

              {errorMsg && !rateLimitSeconds && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-400 font-medium"
                >
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email-input"
                    className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                  >
                    {t("auth.email")}
                  </label>
                  <Input
                    id="email-input"
                    type="email"
                    required
                    placeholder="name@restaurant.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password-input"
                      className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                    >
                      {t("auth.password")}
                    </label>
                    <a
                      href="#"
                      className="text-xs text-[#C2410C] hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        alert("Contact your tenant owner or platform admin to reset password.");
                      }}
                    >
                      {t("auth.forgotPassword")}
                    </a>
                  </div>
                  <Input
                    id="password-input"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Primary Button: #FF6A00 bg with #0B1F3B text (5.7:1 AAA) */}
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full h-11 text-base font-bold shadow"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              </form>

              {/* Demo Quick-Fill Bar: DEV ONLY (tree-shaken in production) */}
              {import.meta.env.DEV && (
                <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#FF6A00]" />
                    <span>Demo Quick-Fill:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => prefill("owner@spicegarden.com")}
                      className="p-1.5 rounded border text-left hover:bg-muted text-[11px]"
                    >
                      <div className="font-semibold text-foreground">Spice Garden Owner</div>
                      <div className="text-[10px] text-muted-foreground">
                        Casual Dining • Table Service
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => prefill("owner@foodieplaza.in")}
                      className="p-1.5 rounded border text-left hover:bg-muted text-[11px]"
                    >
                      <div className="font-semibold text-foreground">Food Court Owner</div>
                      <div className="text-[10px] text-muted-foreground">
                        Foodie Plaza • Counter Pickup
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => prefill("waiter@spicegarden.com")}
                      className="p-1.5 rounded border text-left hover:bg-muted text-[11px]"
                    >
                      <div className="font-semibold text-foreground">Waiter</div>
                      <div className="text-[10px] text-muted-foreground">
                        Spice Garden Floor Staff
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => prefill("admin@fusionengine.in", "AdminPassword123!")}
                      className="p-1.5 rounded border text-left hover:bg-muted text-[11px]"
                    >
                      <div className="font-semibold text-foreground">Platform Admin</div>
                      <div className="text-[10px] text-muted-foreground">Global Console</div>
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <a href="/dev/brand" className="hover:text-foreground underline">
            {t("nav.devBrand")}
          </a>
          <span>•</span>
          <a href="/dev/design-system" className="hover:text-foreground underline">
            {t("nav.devComponents")}
          </a>
        </div>
      </div>
    </div>
  );
};
