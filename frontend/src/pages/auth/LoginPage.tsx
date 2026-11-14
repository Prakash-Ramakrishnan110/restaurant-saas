import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Utensils,
  ShieldCheck,
  Zap,
  Globe,
  Sparkles,
  ChefHat,
  Coffee,
  ShoppingBag,
  Hotel,
  ExternalLink,
} from "lucide-react";
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
import { getRoleHome } from "../../app/navigation";

export interface DemoAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  category: "all" | "kitchen" | "dine_in" | "counter" | "hotel" | "admin";
  venueType: string;
  tagline: string;
  isExternalLink?: boolean;
  linkUrl?: string;
}

const DEMO_CATEGORIES = [
  { id: "all", label: "All Accounts" },
  { id: "kitchen", label: "Kitchen KDS" },
  { id: "dine_in", label: "Dine-In" },
  { id: "counter", label: "Counters" },
  { id: "hotel", label: "Hotel" },
  { id: "admin", label: "Super Admin" },
];

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "kitchen-spice",
    name: "Kitchen KDS (Chef Sanjeev)",
    email: "kitchen@spicegarden.com",
    password: "Password123!",
    role: "KITCHEN",
    category: "kitchen",
    venueType: "RESTAURANT",
    tagline: "Live kitchen tickets • Cook/Ready timers • 86 items",
  },
  {
    id: "restaurant-owner",
    name: "Spice Garden (Dining)",
    email: "owner@spicegarden.com",
    password: "Password123!",
    role: "OWNER",
    category: "dine_in",
    venueType: "RESTAURANT",
    tagline: "AC Hall & Patio (T1–T30) • Waiter POS • Floor Seating",
  },
  {
    id: "finedining-owner",
    name: "Royal Dum Pukht (VIP)",
    email: "owner@royaldumpukht.com",
    password: "Password123!",
    role: "OWNER",
    category: "dine_in",
    venueType: "FINE DINING",
    tagline: "Maharaja VIP Suites • Multi-Course • Seat Ordering",
  },
  {
    id: "cafe-owner",
    name: "Bean & Bloom (Café)",
    email: "owner@beanbloom.in",
    password: "Password123!",
    role: "OWNER",
    category: "dine_in",
    venueType: "CAFE",
    tagline: "Casual Dining Tables • Direct QR • Espresso Catalog",
  },
  {
    id: "teashop-cashier",
    name: "Chai Corner (Tea Shop)",
    email: "cashier@chaicorner.in",
    password: "Password123!",
    role: "CASHIER",
    category: "counter",
    venueType: "TEA SHOP",
    tagline: "Express Token Queue • Pay First • Hot Chai & Snacks",
  },
  {
    id: "bakery-cashier",
    name: "Artisan Bakehouse (Bakery)",
    email: "cashier@artisanbakery.in",
    password: "Password123!",
    role: "CASHIER",
    category: "counter",
    venueType: "BAKERY",
    tagline: "Takeaway Pastries • Bread Case • Token Billing",
  },
  {
    id: "foodcourt-cashier",
    name: "Foodie Plaza (Food Court)",
    email: "cashier@foodieplaza.in",
    password: "Password123!",
    role: "CASHIER",
    category: "counter",
    venueType: "FOOD COURT",
    tagline: "6 Counter Stalls (Wok, Tandoor) • Buzzer Dispatch",
  },
  {
    id: "hotel-owner",
    name: "Grand Meridian (Hotel)",
    email: "owner@grandmeridian.com",
    password: "Password123!",
    role: "OWNER",
    category: "hotel",
    venueType: "HOTEL",
    tagline: "Rooms 101–120 • Room Service QR • Folio Charges",
  },
  {
    id: "platform-admin",
    name: "Platform Super Admin",
    email: "admin@fusionengine.in",
    password: "AdminPassword123!",
    role: "SUPER ADMIN",
    category: "admin",
    venueType: "PLATFORM",
    tagline: "Tenants Directory • Onboarding Wizard • System Health",
  },
];

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
  const [showForgotNotice, setShowForgotNotice] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeDemoId, setActiveDemoId] = useState<string | null>("kitchen-spice");

  const filteredAccounts = useMemo(() => {
    if (selectedCategory === "all") return DEMO_ACCOUNTS;
    return DEMO_ACCOUNTS.filter((acc) => acc.category === selectedCategory);
  }, [selectedCategory]);

  const getDemoIcon = (item: DemoAccount) => {
    if (item.category === "kitchen")
      return <ChefHat className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
    if (item.category === "admin")
      return <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
    if (item.category === "hotel")
      return <Hotel className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
    if (item.venueType === "BAKERY" || item.venueType === "FOOD COURT")
      return <ShoppingBag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
    if (item.venueType === "CAFE" || item.venueType === "TEA SHOP")
      return <Coffee className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />;
    return <Utensils className="w-3.5 h-3.5 text-[#FF6A00]" />;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await login(email, password);
      if (res?.mustChangePassword) {
        navigate("/change-password");
      } else {
        const defaultHome = getRoleHome(res?.role, res?.isPlatformAdmin);
        const locationState = location.state as { from?: { pathname?: string } } | null;
        const requestedPath = locationState?.from?.pathname;

        const isDisallowedForRole = (path: string) => {
          if (res?.isPlatformAdmin) {
            return !path.startsWith("/admin");
          }
          if (res?.role === "WAITER" || res?.role === "CASHIER" || res?.role === "KITCHEN") {
            if (path.startsWith("/dashboard") || path.startsWith("/admin")) return true;
          }
          return false;
        };

        const target =
          requestedPath && requestedPath !== "/login" && !isDisallowedForRole(requestedPath)
            ? requestedPath
            : defaultHome;

        navigate(target, { replace: true });
      }
    } catch (err: unknown) {
      const authErr = err as {
        error?: { code?: string; message?: string; details?: { retry_after?: number } };
        message?: string;
      };
      if (authErr?.error?.code === "RATE_LIMITED") {
        const retryAfter = Number(authErr?.error?.details?.retry_after) || 60;
        setRateLimitSeconds(retryAfter);
      }
      const msg =
        authErr?.error?.message ||
        authErr?.message ||
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
        {/* Subtle decorative chef's hat background glow */}
        <div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full bg-[#FF6A00]/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-[#FF6A00]/5 blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <BrandLogo size={44} theme={theme === "dark" ? "dark" : "light"} />
          <div className="mt-16 max-w-md">
            <h1 className="text-4xl font-extrabold tracking-tight text-[#0B1F3B] dark:text-white leading-tight font-display [text-wrap:balance]">
              {t("brand.tagline")}
            </h1>
            <p className="mt-4 text-base text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
              {t("auth.introParagraph")}
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
                {t("auth.benefit1Title")}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t("auth.benefit1Desc")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3 rounded-lg bg-white/70 dark:bg-white/5 border border-orange-100 dark:border-gray-800 shadow-sm">
            <div className="w-9 h-9 rounded-md bg-[#FF6A00] flex items-center justify-center text-[#0B1F3B] shrink-0 font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#0B1F3B] dark:text-white">
                {t("auth.benefit2Title")}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t("auth.benefit2Desc")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3 rounded-lg bg-white/70 dark:bg-white/5 border border-orange-100 dark:border-gray-800 shadow-sm">
            <div className="w-9 h-9 rounded-md bg-[#FF6A00] flex items-center justify-center text-[#0B1F3B] shrink-0 font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#0B1F3B] dark:text-white">
                {t("auth.benefit3Title")}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t("auth.benefit3Desc")}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="relative z-10 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 font-sans">
          <span>
            ServeMyFood {typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev"}
          </span>
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
        <div className="max-w-xl w-full mx-auto my-6">
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
                    <button
                      type="button"
                      className="text-xs text-[#C2410C] hover:underline"
                      onClick={() => setShowForgotNotice((prev) => !prev)}
                    >
                      {t("auth.forgotPassword")}
                    </button>
                  </div>

                  {showForgotNotice && (
                    <div
                      role="status"
                      className="p-2.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300 flex items-start justify-between gap-2"
                    >
                      <span>{t("auth.forgotPasswordHelp")}</span>
                      <button
                        type="button"
                        onClick={() => setShowForgotNotice(false)}
                        className="font-bold text-blue-800 dark:text-blue-200 hover:opacity-75"
                        aria-label="Dismiss help"
                      >
                        ✕
                      </button>
                    </div>
                  )}
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

              {/* Demo Test Accounts Selector: DEV ONLY (tree-shaken in production) */}
              {import.meta.env.DEV && (
                <div className="mt-6 pt-4 border-t text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-200">
                      <Sparkles className="w-3.5 h-3.5 text-[#FF6A00]" />
                      <span>Demo Test Accounts ({DEMO_ACCOUNTS.length})</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Select to auto-fill</span>
                  </div>

                  {/* Filter chips */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-2 no-scrollbar">
                    {DEMO_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                          selectedCategory === cat.id
                            ? "bg-[#FF6A00] text-[#0B1F3B] font-bold"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Accounts grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {filteredAccounts.map((acc) => {
                      const isSelected = activeDemoId === acc.id;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            if (acc.isExternalLink && acc.linkUrl) {
                              window.open(acc.linkUrl, "_blank");
                            } else {
                              prefill(acc.email, acc.password || "Password123!");
                              setActiveDemoId(acc.id);
                            }
                          }}
                          className={`p-2 rounded-lg border text-left transition-all relative cursor-pointer ${
                            isSelected
                              ? "border-[#FF6A00] bg-orange-50/60 dark:bg-orange-950/20 ring-1 ring-[#FF6A00]/40 shadow-xs"
                              : "border-border hover:border-orange-200 dark:hover:border-navy-700 hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="p-1 rounded bg-muted shrink-0 mt-0.5">
                              {getDemoIcon(acc)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold text-[11px] text-foreground truncate">
                                  {acc.name}
                                </span>
                                {acc.isExternalLink && (
                                  <ExternalLink className="w-3 h-3 text-emerald-600 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 mb-1 flex-wrap">
                                <span className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                                  {acc.venueType}
                                </span>
                                <span className="text-[9px] px-1 py-0.2 rounded font-semibold text-[#C2410C] bg-orange-100/70 dark:bg-orange-950/70">
                                  {acc.role}
                                </span>
                              </div>
                              <div className="text-[10px] text-muted-foreground line-clamp-1">
                                {acc.tagline}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
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
