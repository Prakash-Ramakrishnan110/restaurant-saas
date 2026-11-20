import React, { useState } from "react";
import { Phone, MessageCircle, CheckCircle2 } from "lucide-react";
import { SITE_CONFIG, getWhatsAppHref } from "../../content/site";
import { getPagePath, type Lang } from "../routes";

interface DemoFormProps {
  lang: Lang;
  onNavigate?: (path: string) => void;
  hideQuickLinks?: boolean;
}

const BUSINESS_OPTIONS = [
  { value: "TEA_SHOP", labelEn: "Tea shop", labelTa: "தேநீர்க் கடை" },
  { value: "BAKERY", labelEn: "Bakery", labelTa: "பேக்கரி" },
  { value: "CAFE", labelEn: "Cafe", labelTa: "கஃபே" },
  { value: "RESTAURANT", labelEn: "Restaurant", labelTa: "உணவகம்" },
  { value: "FINE_DINING", labelEn: "Fine dining", labelTa: "சிறப்பு உணவகம்" },
  { value: "HOTEL", labelEn: "Hotel restaurant", labelTa: "ஹோட்டல் உணவகம்" },
  { value: "FOOD_COURT", labelEn: "Food court", labelTa: "உணவு வளாகம்" },
] as const;

export const DemoForm: React.FC<DemoFormProps> = ({ lang, onNavigate, hideQuickLinks = false }) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("RESTAURANT");
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const privacyHref = getPagePath("privacy", lang);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const digits = phone.replace(/[\s\-+]/g, "").replace(/^91(?=\d{10}$)/, "");
    if (!name.trim()) {
      setErrorMsg(lang === "ta" ? "உங்கள் பெயரை உள்ளிடவும்." : "Please enter your name.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setErrorMsg(
        lang === "ta"
          ? "சரியான 10 இலக்க மொபைல் எண்ணை உள்ளிடவும்."
          : "Please enter a valid 10-digit Indian mobile number."
      );
      return;
    }
    if (!city.trim()) {
      setErrorMsg(lang === "ta" ? "உங்கள் நகரத்தை உள்ளிடவும்." : "Please enter your city.");
      return;
    }
    if (!consent) {
      setErrorMsg(
        lang === "ta"
          ? "தொடர்பு கொள்ள அனுமதியைத் தேர்வு செய்யவும்."
          : "Please agree to the privacy notice before submitting."
      );
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch(`${SITE_CONFIG.apiBaseUrl}/api/v1/public/leads/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: digits,
          business_type: businessType,
          city: city.trim(),
          message: message.trim(),
          language: lang,
          consent,
          website,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setErrorMsg(
          body?.error?.message ||
            (lang === "ta"
              ? "கோரிக்கையை அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்."
              : "Could not send your request. Please check your details and try again.")
        );
        return;
      }
      setSubmitted(true);
    } catch {
      setErrorMsg(
        lang === "ta"
          ? "இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்."
          : "Could not reach the server. Please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-950 space-y-2"
      >
        <div className="flex items-center gap-2 font-display font-bold text-lg">
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          <span>
            {lang === "ta" ? "உங்கள் டெமோ கோரிக்கை பெறப்பட்டது!" : "Demo request received!"}
          </span>
        </div>
        <p className="text-sm">
          {lang === "ta"
            ? "எங்கள் குழு விரைவில் உங்கள் மொபைல் எண்ணில் தொடர்பு கொள்ளும்."
            : "Thank you. Our team will contact you shortly on your phone number."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-2xl border border-[#0B1F3B]/15 bg-white p-6 shadow-sm space-y-4"
      >
        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-900"
          >
            {errorMsg}
          </div>
        )}

        {/* Honeypot field */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="lead-website">Website</label>
          <input
            id="lead-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="lead-name" className="block text-xs font-bold text-[#0B1F3B] mb-1">
              {lang === "ta" ? "உங்கள் பெயர் *" : "Your name *"}
            </label>
            <input
              id="lead-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 rounded-lg border border-[#0B1F3B]/25 px-3 text-sm text-[#0B1F3B]"
            />
          </div>

          <div>
            <label htmlFor="lead-phone" className="block text-xs font-bold text-[#0B1F3B] mb-1">
              {lang === "ta" ? "மொபைல் எண் (10 இலக்கம்) *" : "Mobile number (10 digits) *"}
            </label>
            <input
              id="lead-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              className="w-full h-10 rounded-lg border border-[#0B1F3B]/25 px-3 text-sm text-[#0B1F3B]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="lead-type" className="block text-xs font-bold text-[#0B1F3B] mb-1">
              {lang === "ta" ? "வணிக வகை *" : "Business type *"}
            </label>
            <select
              id="lead-type"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full h-10 rounded-lg border border-[#0B1F3B]/25 bg-white px-3 text-sm text-[#0B1F3B]"
            >
              {BUSINESS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === "ta" ? opt.labelTa : opt.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="lead-city" className="block text-xs font-bold text-[#0B1F3B] mb-1">
              {lang === "ta" ? "நகரம் *" : "City *"}
            </label>
            <input
              id="lead-city"
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-10 rounded-lg border border-[#0B1F3B]/25 px-3 text-sm text-[#0B1F3B]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="lead-message" className="block text-xs font-bold text-[#0B1F3B] mb-1">
            {lang === "ta" ? "குறிப்பு (விருப்பம்)" : "Message (optional)"}
          </label>
          <textarea
            id="lead-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-[#0B1F3B]/25 p-3 text-sm text-[#0B1F3B]"
          />
        </div>

        <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#FF6A00]"
          />
          <span>
            {lang === "ta" ? "டெமோவுக்காக என்னைத் தொடர்பு கொள்ள சம்மதிக்கிறேன். " : "I agree to be contacted about a ServeMyFood demo. Read our "}
            <a
              href={privacyHref}
              onClick={(e) => {
                if (onNavigate && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  onNavigate(privacyHref);
                }
              }}
              className="inline-flex items-center min-h-[48px] px-1 font-bold text-[#0B1F3B] underline"
            >
              {lang === "ta" ? "தனியுரிமைக் கொள்கை" : "Privacy notice"}
            </a>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto min-h-[52px] rounded-[12px] bg-[#FF6A00] px-6 py-3 text-[15px] font-semibold text-[#0B1F3B] hover:bg-[#e55f00] disabled:opacity-60"
        >
          {submitting
            ? lang === "ta"
              ? "அனுப்பப்படுகிறது..."
              : "Sending..."
            : lang === "ta"
              ? "இலவச டெமோ பதிவு செய்யுங்கள்"
              : "Book a free demo"}
        </button>
      </form>

      {!hideQuickLinks && (
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={getWhatsAppHref(
              lang === "ta"
                ? "வணக்கம், ServeMyFood டெமோ பற்றி அறிய விரும்புகிறேன்."
                : "Hello, I would like a demo of ServeMyFood."
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 min-h-[48px] rounded-[12px] border border-[#0B1F3B]/25 bg-white px-4 py-2.5 text-xs font-bold text-[#0B1F3B] hover:bg-[#FFF3E0]"
          >
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            <span>{lang === "ta" ? "WhatsApp-இல் பேச" : "Chat on WhatsApp"}</span>
          </a>

          <a
            href={`tel:${SITE_CONFIG.contactPhone.replace(/[^\d+]/g, "")}`}
            className="inline-flex items-center gap-2 min-h-[48px] rounded-[12px] border border-[#0B1F3B]/25 bg-white px-4 py-2.5 text-xs font-bold text-[#0B1F3B] hover:bg-slate-100"
          >
            <Phone className="h-4 w-4 text-[#FF6A00]" />
            <span>{SITE_CONFIG.contactPhone}</span>
          </a>
        </div>
      )}
    </div>
  );
};
