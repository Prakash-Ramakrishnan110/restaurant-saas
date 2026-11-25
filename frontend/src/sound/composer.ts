import {
  DishAnnouncementLevel,
  DishSummaryItem,
  SoundEvent,
  SoundEventType,
  VoiceLanguageMode,
} from "./types";

export interface DetectedVoiceInfo {
  voices: SpeechSynthesisVoice[];
  hasTamilVoice: boolean;
  hasEnglishVoice: boolean;
  tamilVoices: string[];
  englishVoices: string[];
}

export function detectAvailableVoices(): DetectedVoiceInfo {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return {
      voices: [],
      hasTamilVoice: false,
      hasEnglishVoice: false,
      tamilVoices: [],
      englishVoices: [],
    };
  }
  const voices =
    typeof window.speechSynthesis.getVoices === "function"
      ? window.speechSynthesis.getVoices() || []
      : [];
  const tamilVoices = voices
    .filter((v) => v.lang.toLowerCase().startsWith("ta"))
    .map((v) => `${v.name} (${v.lang})`);
  const englishVoices = voices
    .filter((v) => v.lang.toLowerCase().startsWith("en"))
    .map((v) => `${v.name} (${v.lang})`);
  return {
    voices,
    hasTamilVoice: tamilVoices.length > 0,
    hasEnglishVoice: englishVoices.length > 0,
    tamilVoices,
    englishVoices,
  };
}

/**
 * Resolve effective speech language: Tamil only when requested AND supported by device voice,
 * or explicitly set to TA while respecting EN dish fallback if Tamil voice is absent.
 */
export function resolveSpeechLanguage(
  mode: VoiceLanguageMode,
  uiLang: string,
  hasTamilVoice: boolean
): "en" | "ta" {
  if (mode === "EN") return "en";
  if (mode === "TA") return hasTamilVoice ? "ta" : "en";
  return uiLang.toLowerCase().startsWith("ta") && hasTamilVoice ? "ta" : "en";
}

function formatTargetForSpeech(event: SoundEvent, lang: "en" | "ta"): string {
  if (event.token_number != null) {
    return lang === "ta" ? `டோக்கன் ${event.token_number}` : `Token ${event.token_number}`;
  }
  const raw = (event.target_label || "").trim();
  if (!raw) return lang === "ta" ? "அட்டவணை" : "counter";
  if (raw.toLowerCase().startsWith("token")) {
    return lang === "ta" ? raw.replace(/token/i, "டோக்கன்") : raw;
  }
  if (/^[A-Za-z]?\d+$/.test(raw)) {
    return lang === "ta" ? `மேஜை ${raw}` : raw.startsWith("T") ? raw : `Table ${raw}`;
  }
  return lang === "ta" ? raw : raw.startsWith("Table") ? raw : `Table ${raw}`;
}

function formatDishesPhrase(
  dishes: DishSummaryItem[],
  totalItems: number,
  level: DishAnnouncementLevel,
  lang: "en" | "ta",
  hasTamilVoice: boolean
): string {
  if (level === "OFF" || dishes.length === 0) return "";
  const capped = dishes.slice(0, 8);
  const speakLimit = level === "FULL" ? capped.length : Math.min(capped.length, 3);
  const shown = capped.slice(0, speakLimit);
  const useTaNames = lang === "ta" && hasTamilVoice;

  const parts = shown.map((d) => {
    const nm = (useTaNames && d.name_ta ? d.name_ta : d.name).toLowerCase();
    return `${d.qty} ${nm}`;
  });
  const remaining = Math.max(0, totalItems - shown.length);
  if (remaining > 0) {
    return lang === "ta"
      ? `${parts.join(", ")} மற்றும் ${remaining} கூடுதல்`
      : `${parts.join(", ")} and ${remaining} more`;
  }
  return parts.join(", ");
}

function formatRequestNoun(reqType: string, lang: "en" | "ta"): string {
  const clean = reqType.toUpperCase();
  if (lang === "ta") {
    if (clean === "WATER") return "தண்ணீர்";
    if (clean === "BILL") return "பில்";
    if (clean === "CUTLERY") return "கரண்டி";
    if (clean === "NAPKINS") return "துடைக்கும் காகிதம்";
    return "பணியாளர்";
  }
  if (clean === "WATER") return "water";
  if (clean === "BILL") return "bill";
  if (clean === "CUTLERY") return "cutlery";
  if (clean === "NAPKINS") return "napkins";
  return "assistance";
}

/**
 * Composes a speech-ready string strictly obeying privacy rules (<= 12s duration).
 * Customer names, notes, phone numbers, and prices are never included.
 */
export function composeAnnouncementText(
  event: SoundEvent,
  options: {
    voiceLanguage: VoiceLanguageMode;
    uiLang?: string;
    dishAnnouncementLevel: DishAnnouncementLevel;
    hasTamilVoice?: boolean;
  }
): string {
  const detected =
    options.hasTamilVoice !== undefined
      ? { hasTamilVoice: options.hasTamilVoice }
      : detectAvailableVoices();
  const lang = resolveSpeechLanguage(
    options.voiceLanguage,
    options.uiLang || "en",
    detected.hasTamilVoice
  );
  const target = formatTargetForSpeech(event, lang);

  let text = "";
  switch (event.event_type) {
    case "new_order": {
      const dishes = formatDishesPhrase(
        event.dishes || [],
        event.total_items ?? (event.dishes?.length || 0),
        options.dishAnnouncementLevel,
        lang,
        detected.hasTamilVoice
      );
      const prefix = lang === "ta" ? `புதிய ஆர்டர். ${target}` : `New order. ${target}`;
      text = dishes ? `${prefix}. ${dishes}` : prefix;
      break;
    }
    case "qr_needs_approval":
      text = lang === "ta" ? `ஆர்டர் அனுமதி தேவை, ${target}` : `Order needs approval, ${target}`;
      break;
    case "pay_first_waiting":
      text =
        lang === "ta"
          ? `${target}, கட்டணம் செலுத்த காத்திருக்கிறது`
          : `${target}, waiting for payment`;
      break;
    case "table_ready":
      text = lang === "ta" ? `${target} தயார்` : `${target} ready`;
      break;
    case "token_ready":
      text = lang === "ta" ? `${target} தயார்` : `${target} ready`;
      break;
    case "guest_request_service": {
      const noun = formatRequestNoun(event.request_type || "CALL_WAITER", lang);
      text = lang === "ta" ? `${target} ${noun} தேவை` : `${target} needs ${noun}`;
      break;
    }
    case "guest_request_bill":
      text = lang === "ta" ? `${target} பில் தேவை` : `${target} needs bill`;
      break;
    case "ticket_late":
      text = lang === "ta" ? `${target} தாமதமாகிறது` : `${target} ticket overdue`;
      break;
    case "payment_received":
      text = lang === "ta" ? "கட்டணம் பெறப்பட்டது" : "Payment received";
      break;
    default:
      text = target;
  }

  // Enforce 12-second speech budget (~220 characters max)
  return text.trim().slice(0, 220);
}

export function composeBurstSummaryText(
  eventType: SoundEventType,
  count: number,
  lang: "en" | "ta"
): string {
  if (lang === "ta") {
    if (eventType === "new_order") return `${count} புதிய ஆர்டர்கள்`;
    if (eventType === "table_ready" || eventType === "token_ready")
      return `${count} ஆர்டர்கள் தயார்`;
    return `${count} புதிய அறிவிப்புகள்`;
  }
  if (eventType === "new_order") return `${count} new orders`;
  if (eventType === "table_ready" || eventType === "token_ready") return `${count} orders ready`;
  if (eventType === "guest_request_service" || eventType === "guest_request_bill") {
    return `${count} guest requests`;
  }
  return `${count} new notifications`;
}

/**
 * Generates ordered audio clip paths for numbers 0..999 (used by optional recorded clip playback).
 */
export function composeNumberClips(n: number, lang: "en" | "ta"): string[] {
  const val = Math.max(0, Math.min(999, Math.trunc(n)));
  const base = `/sound/voice/${lang}`;
  if (val < 100) {
    return [`${base}/${val}.wav`];
  }
  const hundreds = Math.floor(val / 100) * 100;
  const rem = val % 100;
  return rem === 0
    ? [`${base}/${hundreds}.wav`]
    : [`${base}/${hundreds}.wav`, `${base}/${rem}.wav`];
}

export function composeEventClips(event: SoundEvent, lang: "en" | "ta"): string[] {
  const base = `/sound/voice/${lang}`;
  if (event.event_type === "token_ready" && event.token_number != null) {
    return [
      `${base}/token.wav`,
      ...composeNumberClips(event.token_number, lang),
      `${base}/ready.wav`,
    ];
  }
  if (event.event_type === "new_order") {
    return [`${base}/new-order.wav`];
  }
  if (event.event_type === "qr_needs_approval") {
    return [`${base}/needs-approval.wav`];
  }
  if (event.event_type === "guest_request_bill") {
    return [`${base}/needs-bill.wav`];
  }
  return [];
}
