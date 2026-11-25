import React, { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Volume2,
  Bell,
  Play,
  CheckCircle2,
  Megaphone,
  ShieldAlert,
  Save,
  Monitor,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { AuthContext } from "../../context/AuthContext";
import { ordersApi } from "../../api/orders";
import { soundEngine } from "../../sound/engine";
import {
  composeAnnouncementText,
  detectAvailableVoices,
  DetectedVoiceInfo,
} from "../../sound/composer";
import {
  DeviceSoundPreferences,
  DishAnnouncementLevel,
  EventRulePreference,
  SoundEvent,
  SoundEventType,
  VoiceLanguageMode,
} from "../../sound/types";

interface EventCatalogMeta {
  type: SoundEventType;
  labelEn: string;
  labelTa: string;
  descEn: string;
  descTa: string;
  rolesEn: string;
  sampleEvent: SoundEvent;
}

const EVENT_CATALOG: EventCatalogMeta[] = [
  {
    type: "new_order",
    labelEn: "New Order Placed",
    labelTa: "புதிய ஆர்டர்",
    descEn: "Chimes and reads table or token with dish summary for kitchen staff.",
    descTa: "சமையலறைக்காக புதிய ஆர்டரை ஒலி & குரலில் அறிவிக்கும்.",
    rolesEn: "Kitchen, Branch Manager",
    sampleEvent: {
      event_id: "sample-new-order",
      event_type: "new_order",
      target_label: "T4",
      dishes: [
        { name: "Dosa", name_ta: "தோசை", qty: 2 },
        { name: "Idly", name_ta: "இட்லி", qty: 1 },
      ],
      total_items: 5,
    },
  },
  {
    type: "qr_needs_approval",
    labelEn: "QR Order Needs Approval",
    labelTa: "QR ஆர்டர் ஒப்புதல் தேவை",
    descEn: "Alerts floor staff when a guest QR order awaits confirmation.",
    descTa: "விருந்தினர் QR ஆர்டர் ஒப்புதலுக்காக காத்திருக்கும்போது அறிவிக்கும்.",
    rolesEn: "Waiter, Cashier",
    sampleEvent: {
      event_id: "sample-qr-approval",
      event_type: "qr_needs_approval",
      target_label: "T4",
    },
  },
  {
    type: "pay_first_waiting",
    labelEn: "Pay-First Order Waiting",
    labelTa: "முன்கூட்டிய கட்டணம் காத்திருப்பு",
    descEn: "Alerts counter cashier when a guest selects pay at the counter.",
    descTa: "கவுண்டர் கட்டண ஆர்டர் காத்திருக்கும்போது காசாளரை அழைக்கும்.",
    rolesEn: "Cashier",
    sampleEvent: {
      event_id: "sample-pay-first",
      event_type: "pay_first_waiting",
      target_label: "Token 12",
      token_number: 12,
    },
  },
  {
    type: "table_ready",
    labelEn: "Food Ready (Table Service)",
    labelTa: "உணவு தயார் (மேஜை)",
    descEn: "Ascending chime when kitchen marks a table order ready.",
    descTa: "மேஜை உணவு சமைத்து தயாரானவுடன் ஒலிக்கும்.",
    rolesEn: "Waiter",
    sampleEvent: {
      event_id: "sample-table-ready",
      event_type: "table_ready",
      target_label: "T4",
    },
  },
  {
    type: "token_ready",
    labelEn: "Token Ready at Counter",
    labelTa: "டோக்கன் தயார் (கவுண்டர்)",
    descEn: "Bell callout when counter pickup token is called.",
    descTa: "டோக்கன் எண் கவுண்டரில் தயாராகும்போது ஒலிக்கும்.",
    rolesEn: "Cashier, Waiter, Token TV",
    sampleEvent: {
      event_id: "sample-token-ready",
      event_type: "token_ready",
      target_label: "Token 12",
      token_number: 12,
    },
  },
  {
    type: "guest_request_service",
    labelEn: "Guest Service / Water Call",
    labelTa: "விருந்தினர் சேவை / தண்ணீர் அழைப்பு",
    descEn: "Soft service bell when a table taps Call Waiter, Water, or Cutlery.",
    descTa: "விருந்தினர் ஊழியர் அல்லது தண்ணீர் கேட்டால் ஒலிக்கும்.",
    rolesEn: "Waiter",
    sampleEvent: {
      event_id: "sample-svc-call",
      event_type: "guest_request_service",
      target_label: "T4",
      request_type: "WATER",
    },
  },
  {
    type: "guest_request_bill",
    labelEn: "Guest Requesting Bill",
    labelTa: "விருந்தினர் பில் கேட்டார்",
    descEn: "Alerts waiter and cashier when a table asks for the bill.",
    descTa: "விருந்தினர் பில் கேட்டவுடன் காசாளருக்கும் ஊழியருக்கும் அறிவிக்கும்.",
    rolesEn: "Cashier, Waiter",
    sampleEvent: {
      event_id: "sample-bill-call",
      event_type: "guest_request_bill",
      target_label: "T4",
      request_type: "BILL",
    },
  },
  {
    type: "ticket_late",
    labelEn: "Kitchen Ticket Overdue (>20m)",
    labelTa: "தாமதமான சமையல் ஆர்டர் (>20 நிமிடம்)",
    descEn: "Escalation tone when a kitchen ticket waits more than 20 minutes.",
    descTa: "20 நிமிடத்திற்கு மேல் தாமதமாகும் ஆர்டர்களுக்கு எச்சரிக்கை ஒலிக்கும்.",
    rolesEn: "Kitchen, Branch Manager",
    sampleEvent: {
      event_id: "sample-ticket-late",
      event_type: "ticket_late",
      target_label: "T4",
      elapsed_minutes: 22,
    },
  },
  {
    type: "payment_received",
    labelEn: "Payment Received",
    labelTa: "கட்டணம் பெறப்பட்டது",
    descEn: "Short confirmation chime after bill settlement.",
    descTa: "பில் கட்டணம் முடிந்தவுடன் சிறிய உறுதிப்படுத்தல் ஒலி.",
    rolesEn: "Cashier",
    sampleEvent: {
      event_id: "sample-payment-ok",
      event_type: "payment_received",
      target_label: "T4",
    },
  },
];

export const SoundSettingsPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isTa = i18n.language.startsWith("ta");
  const authCtx = useContext(AuthContext);
  const activeRole = authCtx?.activeRole ?? null;

  const [prefs, setPrefs] = useState<DeviceSoundPreferences>(() => soundEngine.getPreferences());
  const [unlocked, setUnlocked] = useState<boolean>(() => soundEngine.isUnlocked());
  const [voicesInfo, setVoicesInfo] = useState<DetectedVoiceInfo>(() => detectAvailableVoices());
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [branchSaveNotice, setBranchSaveNotice] = useState<string | null>(null);
  const [savingBranch, setSavingBranch] = useState(false);

  const canManageBranchDefaults = ["OWNER", "BRANCH_MANAGER"].includes(
    (activeRole || "").toUpperCase()
  );

  useEffect(() => {
    const refreshVoices = () => setVoicesInfo(detectAvailableVoices());
    refreshVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
    }
    const unsub = soundEngine.subscribe((snap) => setUnlocked(snap.unlocked));
    return () => {
      unsub();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.removeEventListener?.("voiceschanged", refreshVoices);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof ordersApi.getSoundDefaults !== "function") return;
    ordersApi
      .getSoundDefaults()
      .then((res) => {
        if (!res?.data?.events) return;
        setPrefs((prev) => ({
          ...prev,
          voiceLanguage: res.data.voice_language || prev.voiceLanguage,
          dishAnnouncementLevel: res.data.dish_announcement_level || prev.dishAnnouncementLevel,
          speechRate: res.data.speech_rate || prev.speechRate,
          events: {
            ...prev.events,
            ...res.data.events,
          },
        }));
      })
      .catch(() => {
        // Ignore when offline or mocked in unit tests
      });
  }, []);

  const handleUnlockAudio = async () => {
    await soundEngine.unlock();
    setUnlocked(true);
    soundEngine.playTone("new-order");
  };

  const updateEventRule = (
    eventType: SoundEventType,
    patch: Partial<EventRulePreference>
  ): void => {
    setPrefs((prev) => ({
      ...prev,
      events: {
        ...prev.events,
        [eventType]: {
          ...prev.events[eventType],
          ...patch,
        },
      },
    }));
  };

  const handleSaveDevice = () => {
    soundEngine.updatePreferences(prefs);
    setSavedNotice(
      isTa
        ? "இந்த சாதனத்தின் ஒலி அமைப்புகள் சேமிக்கப்பட்டன."
        : "Sound settings saved on this device."
    );
    window.setTimeout(() => setSavedNotice(null), 3500);
  };

  const handleSaveBranchDefaults = async () => {
    setSavingBranch(true);
    try {
      await ordersApi.updateSoundDefaults({
        voice_language: prefs.voiceLanguage,
        dish_announcement_level: prefs.dishAnnouncementLevel,
        speech_rate: prefs.speechRate,
        events: prefs.events,
      });
      setBranchSaveNotice(
        isTa
          ? "கிளை இயல்புநிலை ஒலி அமைப்புகள் சேமிக்கப்பட்டன."
          : "Branch default sound rules saved on server."
      );
      window.setTimeout(() => setBranchSaveNotice(null), 3500);
    } catch {
      setBranchSaveNotice(
        isTa ? "சேமிப்பதில் பிழை ஏற்பட்டது." : "Unable to update branch defaults."
      );
    } finally {
      setSavingBranch(false);
    }
  };

  const handleTestEvent = async (meta: EventCatalogMeta) => {
    await soundEngine.unlock();
    setUnlocked(true);
    soundEngine.updatePreferences(prefs);
    soundEngine.enqueue(
      {
        ...meta.sampleEvent,
        event_id: `test-${meta.type}-${Date.now()}`,
      },
      { bypassMute: true }
    );
  };

  const handleTestVoiceSample = async (lang: "en" | "ta") => {
    await soundEngine.unlock();
    setUnlocked(true);
    const sample: SoundEvent = {
      event_id: `voice-test-${lang}-${Date.now()}`,
      event_type: "new_order",
      target_label: "T4",
      dishes: [
        { name: "Dosa", name_ta: "தோசை", qty: 2 },
        { name: "Idly", name_ta: "இட்லி", qty: 1 },
      ],
      total_items: 5,
    };
    const previewPrefs: DeviceSoundPreferences = {
      ...prefs,
      soundEnabled: true,
      voiceEnabled: true,
      voiceLanguage: lang === "ta" ? "TA" : "EN",
    };
    soundEngine.updatePreferences(previewPrefs);
    soundEngine.enqueue(sample, { bypassMute: true, forceSpeech: true });
  };

  return (
    <div className="max-w-4xl space-y-6 font-sans pb-8" data-testid="sound-settings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">
            {isTa ? "ஒலி & அறிவிப்புகள் (Sound & Alerts)" : "Sound & Alerts"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isTa
              ? "ஆர்டர்கள், டோக்கன் அழைப்புகள் மற்றும் விருந்தினர் அழைப்புகளுக்கான ஒலி & குரல் விதிகளை அமைக்கவும்."
              : "Configure chimes, EN/TA voice announcements, repeat reminders, and screen wake lock for staff devices."}
          </p>
        </div>

        <Button
          type="button"
          onClick={handleUnlockAudio}
          data-testid="start-sound-settings-btn"
          className="min-h-[56px] px-5 bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-extrabold gap-2 shrink-0"
        >
          <Volume2 className="h-5 w-5" />
          <span>
            {unlocked
              ? isTa
                ? "ஒலி இயக்கப்பட்டது"
                : "Sound Active"
              : isTa
                ? "ஒலியைத் தொடங்கு"
                : "Start Sound"}
          </span>
        </Button>
      </div>

      {/* Master Controls */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-5">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#FF6A00]" />
          {isTa ? "முதன்மை ஒலி கட்டுப்பாடுகள்" : "Master Audio Controls"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-muted/20 min-h-[56px] cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {isTa ? "அலர்ட் ஒலி இயக்கு" : "Enable Alert Sounds"}
              </div>
              <div className="text-xs text-muted-foreground">
                {isTa
                  ? "ஆர்டர் மற்றும் சேவை அழைப்புகளுக்கு ஒலி"
                  : "Play distinct chimes for incoming alerts"}
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.soundEnabled}
              onChange={(e) => setPrefs((p) => ({ ...p, soundEnabled: e.target.checked }))}
              className="h-5 w-5 accent-[#FF6A00]"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-muted/20 min-h-[56px] cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {isTa ? "குரல் அறிவிப்பு இயக்கு" : "Enable Voice Callouts"}
              </div>
              <div className="text-xs text-muted-foreground">
                {isTa
                  ? "மேஜை/டோக்கன் மற்றும் உணவு சுருக்கம் வாசிக்கவும்"
                  : "Read table/token and dish summary aloud"}
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.voiceEnabled}
              onChange={(e) => setPrefs((p) => ({ ...p, voiceEnabled: e.target.checked }))}
              className="h-5 w-5 accent-[#FF6A00]"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-muted/20 min-h-[56px] cursor-pointer">
            <div className="flex items-start gap-2.5">
              <Monitor className="h-4 w-4 text-[#FF6A00] mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {isTa ? "திரையை விழித்திருக்க செய்" : "Keep Screen Awake"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isTa
                    ? "KDS / காசாளர் திரை அணைவதைத் தடுக்கவும்"
                    : "Prevent tablet/display sleep while monitoring orders"}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              data-testid="keep-screen-awake-toggle"
              checked={prefs.keepScreenAwake}
              onChange={(e) => setPrefs((p) => ({ ...p, keepScreenAwake: e.target.checked }))}
              className="h-5 w-5 accent-[#FF6A00]"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-muted/20 min-h-[56px] cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {isTa ? "பதிவு செய்யப்பட்ட ஒலி துணுக்குகள்" : "Prefer Recorded Voice Clips"}
              </div>
              <div className="text-xs text-muted-foreground">
                {isTa
                  ? "கிடைக்காவிட்டால் கணினி குரலுக்கு தானாக மாறும்"
                  : "Auto-falls back to device voice or chime if clips unavailable"}
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.useRecordedClips}
              onChange={(e) => setPrefs((p) => ({ ...p, useRecordedClips: e.target.checked }))}
              className="h-5 w-5 accent-[#FF6A00]"
            />
          </label>
        </div>

        {/* Sliders & Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-border">
          <div className="space-y-1.5">
            <label
              htmlFor="sound-volume-slider"
              className="text-xs font-bold text-foreground block"
            >
              {isTa ? "ஒலி அளவு" : "Master Volume"} ({Math.round(prefs.volume * 100)}%)
            </label>
            <input
              id="sound-volume-slider"
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round(prefs.volume * 100)}
              onChange={(e) => setPrefs((p) => ({ ...p, volume: Number(e.target.value) / 100 }))}
              className="w-full accent-[#FF6A00]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="speech-rate-slider" className="text-xs font-bold text-foreground block">
              {isTa ? "குரல் வேகம்" : "Voice Speed"} ({prefs.speechRate.toFixed(1)}x)
            </label>
            <input
              id="speech-rate-slider"
              type="range"
              min={0.7}
              max={1.4}
              step={0.1}
              value={prefs.speechRate}
              onChange={(e) => setPrefs((p) => ({ ...p, speechRate: Number(e.target.value) }))}
              className="w-full accent-[#FF6A00]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="voice-lang-select" className="text-xs font-bold text-foreground block">
              {isTa ? "குரல் மொழி" : "Voice Language"}
            </label>
            <select
              id="voice-lang-select"
              data-testid="voice-lang-select"
              value={prefs.voiceLanguage}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, voiceLanguage: e.target.value as VoiceLanguageMode }))
              }
              className="w-full min-h-[44px] rounded-md border border-input bg-background px-2.5 text-sm font-medium"
            >
              <option value="AUTO">{isTa ? "தானியங்கி (AUTO)" : "Auto (UI Language)"}</option>
              <option value="EN">English</option>
              <option value="TA">தமிழ் (Tamil)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="dish-level-select" className="text-xs font-bold text-foreground block">
              {isTa ? "உணவு அறிவிப்பு" : "Dish Announcements"}
            </label>
            <select
              id="dish-level-select"
              data-testid="dish-level-select"
              value={prefs.dishAnnouncementLevel}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  dishAnnouncementLevel: e.target.value as DishAnnouncementLevel,
                }))
              }
              className="w-full min-h-[44px] rounded-md border border-input bg-background px-2.5 text-sm font-medium"
            >
              <option value="OFF">{isTa ? "நிறுத்து (இடம் மட்டும்)" : "Off (Target only)"}</option>
              <option value="SUMMARY">
                {isTa ? "சுருக்கம் (முதல் 3 உணவுகள்)" : "Summary (Max 3 dishes)"}
              </option>
              <option value="FULL">
                {isTa ? "முழு பட்டியல் (அதிகபட்சம் 8)" : "Full (Up to 8 dishes)"}
              </option>
            </select>
          </div>
        </div>
      </section>

      {/* Voice Test & Device Voice Detection */}
      <section
        className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4"
        data-testid="voice-test-panel"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-[#FF6A00]" />
              {isTa ? "குரல் சோதனை & சாதன ஆதரவு" : "Voice Test & System Voice Check"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isTa
                ? "தமிழ் குரல் இல்லாத சாதனங்களில், உணவுப் பெயர்கள் ஆங்கிலத்தில் தெளிவாக வாசிக்கப்படும்."
                : "If no Tamil voice is installed on this browser, dish names safely fall back to English voice."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={voicesInfo.hasTamilVoice ? "default" : "outline"}
              data-testid="tamil-voice-status"
            >
              {voicesInfo.hasTamilVoice
                ? isTa
                  ? `தமிழ் குரல் உள்ளது (${voicesInfo.tamilVoices.length})`
                  : `Tamil Voice Detected (${voicesInfo.tamilVoices.length})`
                : isTa
                  ? "தமிழ் குரல் இல்லை (ஆங்கிலம் பயன்படும்)"
                  : "No Tamil Voice Found (EN fallback ready)"}
            </Badge>
            <Badge variant="outline">
              {isTa
                ? `மொத்த குரல்கள்: ${voicesInfo.voices.length}`
                : `System Voices: ${voicesInfo.voices.length}`}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-xs font-mono text-foreground border border-border">
          Preview ({isTa ? "Sample" : "Privacy-safe, zero prices/notes"}):{" "}
          {composeAnnouncementText(EVENT_CATALOG[0].sampleEvent, {
            voiceLanguage: prefs.voiceLanguage,
            uiLang: isTa ? "ta" : "en",
            dishAnnouncementLevel: prefs.dishAnnouncementLevel,
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleTestVoiceSample("en")}
            className="min-h-[56px] px-4 gap-2 font-semibold"
          >
            <Play className="h-4 w-4 text-[#FF6A00]" />
            {isTa ? "ஆங்கில குரல் சோதனை" : "Test Voice (EN)"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleTestVoiceSample("ta")}
            className="min-h-[56px] px-4 gap-2 font-semibold"
          >
            <Play className="h-4 w-4 text-[#FF6A00]" />
            {isTa ? "தமிழ் குரல் சோதனை" : "Test Voice (TA)"}
          </Button>
        </div>

        {voicesInfo.voices.length > 0 && (
          <div className="text-xs text-muted-foreground max-h-24 overflow-y-auto border-t border-border pt-2">
            {voicesInfo.voices
              .slice(0, 12)
              .map((v) => `${v.name} [${v.lang}]`)
              .join(" • ")}
          </div>
        )}
      </section>

      {/* Per-Event Catalog Controls */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-foreground">
            {isTa ? "நிகழ்வு வாரியான ஒலி & குரல் விதிகள்" : "Event Chime, Voice & Escalation Rules"}
          </h2>
          <span className="text-xs text-muted-foreground">
            {isTa ? "9 நிகழ்வு வகைகள்" : "9 Restaurant Events"}
          </span>
        </div>

        <div className="divide-y divide-border">
          {EVENT_CATALOG.map((meta) => {
            const rule = prefs.events[meta.type] || {
              chime: true,
              voice: true,
              repeat_seconds: 0,
            };
            return (
              <div
                key={meta.type}
                data-testid={`sound-event-row-${meta.type}`}
                className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-foreground">
                      {isTa ? meta.labelTa : meta.labelEn}
                    </span>
                    <Badge variant="outline" className="text-[11px]">
                      {meta.rolesEn}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isTa ? meta.descTa : meta.descEn}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium min-h-[44px] px-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.chime}
                      onChange={(e) => updateEventRule(meta.type, { chime: e.target.checked })}
                      className="h-4 w-4 accent-[#FF6A00]"
                    />
                    {isTa ? "ஒலி" : "Chime"}
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-xs font-medium min-h-[44px] px-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.voice}
                      onChange={(e) => updateEventRule(meta.type, { voice: e.target.checked })}
                      className="h-4 w-4 accent-[#FF6A00]"
                    />
                    {isTa ? "குரல்" : "Voice"}
                  </label>

                  <select
                    aria-label={`${meta.labelEn} repeat rule`}
                    value={String(rule.repeat_seconds || 0)}
                    onChange={(e) =>
                      updateEventRule(meta.type, {
                        repeat_seconds: Number(e.target.value),
                        nag: Number(e.target.value) > 0,
                      })
                    }
                    className="min-h-[44px] rounded-md border border-input bg-background px-2 text-xs font-medium"
                  >
                    <option value="0">{isTa ? "ஒரு முறை" : "Once"}</option>
                    <option value="45">{isTa ? "45 விநாடிக்கு" : "Every 45s"}</option>
                    <option value="60">{isTa ? "60 விநாடிக்கு" : "Every 60s"}</option>
                    <option value="90">{isTa ? "90 விநாடிக்கு" : "Every 90s"}</option>
                    <option value="120">{isTa ? "120 விநாடிக்கு" : "Every 120s"}</option>
                  </select>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleTestEvent(meta)}
                    data-testid={`test-event-${meta.type}`}
                    className="min-h-[56px] px-4 gap-1.5 font-semibold"
                  >
                    <Play className="h-3.5 w-3.5 text-[#FF6A00]" />
                    <span>{isTa ? "சோதனை" : "Test"}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Privacy Notice */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-[#FF6A00] shrink-0 mt-0.5" />
        <span>
          {isTa
            ? "வாடிக்கையாளர் பெயர், தொலைபேசி எண், குறிப்புகள் மற்றும் விலைகள் ஒருபோதும் குரல் வழியாக வாசிக்கப்படாது."
            : "Customer names, phone numbers, kitchen notes, and prices are never included in voice announcements."}
        </span>
      </div>

      {/* Save Action Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="space-y-1">
          {savedNotice && (
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {savedNotice}
            </div>
          )}
          {branchSaveNotice && (
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {branchSaveNotice}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {canManageBranchDefaults && (
            <Button
              type="button"
              variant="outline"
              disabled={savingBranch}
              onClick={() => void handleSaveBranchDefaults()}
              data-testid="save-branch-sound-defaults-btn"
              className="min-h-[56px] px-5 font-bold gap-2"
            >
              <Save className="h-4 w-4 text-[#FF6A00]" />
              {isTa ? "கிளை இயல்புநிலையாக சேமி" : "Save as Branch Default"}
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSaveDevice}
            data-testid="save-device-sound-btn"
            className="min-h-[56px] px-6 bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-extrabold gap-2"
          >
            <Save className="h-4 w-4" />
            {isTa ? "விருப்பங்களை சேமி (Save Preferences)" : "Save Preferences"}
          </Button>
        </div>
      </div>
    </div>
  );
};
