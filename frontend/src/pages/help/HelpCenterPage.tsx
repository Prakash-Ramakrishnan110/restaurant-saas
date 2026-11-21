import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Search,
  LifeBuoy,
  Keyboard,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";

interface HelpArticle {
  id: string;
  title: string;
  titleTa: string;
  roles: string[];
  venueScope: "ALL" | "TABLE" | "COUNTER";
  body: string[];
}

const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "getting-started",
    title: "Getting Started & Account Setup (30-Min Checklist)",
    titleTa: "தொடக்க வழிகாட்டி மற்றும் கணக்கு அமைப்பு",
    roles: ["OWNER", "BRANCH_MANAGER", "CASHIER", "WAITER", "KITCHEN"],
    venueScope: "ALL",
    body: [
      "1. Your restaurant account is provisioned by Fusion Engine Technology. Change your temporary password on first sign-in.",
      "2. Open Onboarding to complete your 7-step venue, layout, QR standee, and staff setup.",
      "3. Upload your restaurant logo and primary brand color in Branding.",
    ],
  },
  {
    id: "menu-photos-translations",
    title: "Menu, Bulk Photo Upload & Translations",
    titleTa: "மெனு, புகைப்படங்கள் மற்றும் மொழிபெயர்ப்பு",
    roles: ["OWNER", "BRANCH_MANAGER"],
    venueScope: "ALL",
    body: [
      "1. Open Menu to manage categories, dishes, variants, option groups, ingredients notes, and allergen notes.",
      "2. Click Upload photos to batch-upload up to 50 JPEG/PNG/WebP photos and confirm proposed dish matches.",
      "3. Open Translations to review and publish Tamil or regional menu translations.",
    ],
  },
  {
    id: "orders-kds-billing",
    title: "Taking Orders, Kitchen KDS & Shift Closeout",
    titleTa: "ஆர்டர்கள், சமையலறை திரை மற்றும் பில்லிங்",
    roles: ["OWNER", "BRANCH_MANAGER", "CASHIER", "WAITER", "KITCHEN"],
    venueScope: "ALL",
    body: [
      "1. Waiters and cashiers fire orders from Floor POS or Counter Orders straight to Kitchen KDS.",
      "2. Kitchen staff bump tickets through Preparing and Ready.",
      "3. Cashiers settle full payments in Cashier Billing and reconcile cash in Shift Close.",
    ],
  },
  {
    id: "printer-setup",
    title: "Thermal Printer Setup (58mm / 80mm & Kiosk Mode)",
    titleTa: "பிரிண்டர் அமைப்பு மற்றும் சரிசெய்தல்",
    roles: ["OWNER", "BRANCH_MANAGER", "CASHIER"],
    venueScope: "ALL",
    body: [
      "1. Open Printers & Devices to choose 58mm or 80mm paper width and print a test receipt.",
      "2. In Chrome print settings: set Margins to None, turn Headers and footers Off, and set Scale to 100%.",
      "3. For silent kiosk printing, launch Chrome with --kiosk-printing and verify on your physical printer.",
    ],
  },
];

const COMING_SOON_ITEMS = [
  "Online payments, UPI deep links & payment sound boxes (pending owner gateway setup)",
  "Delivery & scheduled pickup with OTP verification",
  "Direct USB/LAN ESC/POS hardware print bridge",
];

declare const __APP_VERSION__: string;

export const HelpCenterPage: React.FC = () => {
  const { activeTenant, activeRole } = useAuth();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"articles" | "shortcuts" | "support">("articles");

  // Contact support state (OWNER & BRANCH_MANAGER)
  const canCreateSupport = activeRole === "OWNER" || activeRole === "BRANCH_MANAGER";
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [supportNotice, setSupportNotice] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HELP_ARTICLES.filter((a) => {
      if (activeRole && !a.roles.includes(activeRole)) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.titleTa.toLowerCase().includes(q) ||
        a.body.some((line) => line.toLowerCase().includes(q))
      );
    });
  }, [query, activeRole]);

  const handleSubmitSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    setSupportNotice(null);
    setSupportError(null);
    try {
      await apiClient.post("/support-tickets/", {
        subject: subject.trim(),
        category,
        message: message.trim().slice(0, 1000),
        context: {
          route: "/help",
          app_version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.4.0",
          role: activeRole || "STAFF",
          restaurant_name: activeTenant?.tenant_name || "Restaurant",
        },
      });
      setSubject("");
      setMessage("");
      setSupportNotice("Support request submitted. Our team will respond shortly.");
    } catch (err: any) {
      setSupportError(err?.response?.data?.detail || "Could not submit support request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#FF6A00]" />
            Help Center &amp; Guides
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Step-by-step operational guides, keyboard shortcuts, and support • App v
            {typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.4.0"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant={activeTab === "articles" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("articles")}
            className={activeTab === "articles" ? "bg-[#0B1F3B] text-white" : ""}
          >
            <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Guides
          </Button>
          <Button
            type="button"
            variant={activeTab === "shortcuts" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("shortcuts")}
            className={activeTab === "shortcuts" ? "bg-[#0B1F3B] text-white" : ""}
          >
            <Keyboard className="w-3.5 h-3.5 mr-1.5" /> Shortcuts &amp; Roadmap
          </Button>
          {canCreateSupport && (
            <Button
              type="button"
              variant={activeTab === "support" ? "default" : "outline"}
              size="sm"
              data-testid="help-contact-support-tab"
              onClick={() => setActiveTab("support")}
              className={activeTab === "support" ? "bg-[#FF6A00] text-[#0B1F3B] font-bold" : ""}
            >
              <LifeBuoy className="w-3.5 h-3.5 mr-1.5" /> Contact Support
            </Button>
          )}
        </div>
      </div>

      {activeTab === "articles" && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search help guides"
              placeholder="Search guides (e.g. printer, menu, billing)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map((art) => (
              <Card key={art.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold">{art.title}</CardTitle>
                  <div className="text-[11px] text-muted-foreground">{art.titleTa}</div>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs text-muted-foreground">
                  {art.body.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === "shortcuts" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-[#FF6A00]" /> Keyboard Shortcuts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between py-1 border-b border-border">
                <span>Quick Search / Jump to Page</span>
                <kbd className="px-2 py-0.5 rounded bg-muted font-mono">Ctrl + K</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span>Close Active Dialog / Sheet</span>
                <kbd className="px-2 py-0.5 rounded bg-muted font-mono">Esc</kbd>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF6A00]" /> Coming Soon
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-muted-foreground">
              {COMING_SOON_ITEMS.map((item, idx) => (
                <div key={idx}>• {item}</div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "support" && canCreateSupport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-[#FF6A00]" /> Contact Fusion Engine Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground">
              <strong>Privacy Notice:</strong> Submitting a support request automatically attaches
              only your current route, app version, role, and restaurant name. No customer, order,
              or payment records are ever attached.
            </div>

            {supportNotice && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{supportNotice}</span>
              </div>
            )}
            {supportError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{supportError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitSupport} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Subject</label>
                  <Input
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Need help setting up 80mm printer"
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Category</label>
                  <select
                    aria-label="Support Category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-xs min-h-[38px]"
                  >
                    <option value="GENERAL">General Question</option>
                    <option value="PRINTER">Printer &amp; Hardware</option>
                    <option value="MENU">Menu &amp; Translations</option>
                    <option value="BILLING">Plan &amp; Account</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-semibold block mb-1">Message ({message.length}/1000)</label>
                <textarea
                  required
                  maxLength={1000}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what you need help with..."
                  className="w-full p-2.5 rounded-md border border-input bg-background text-xs"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold text-xs"
              >
                {submitting ? "Submitting..." : "Send Support Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
