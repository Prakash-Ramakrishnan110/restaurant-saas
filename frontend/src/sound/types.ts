export type SoundEventType =
  | "new_order"
  | "qr_needs_approval"
  | "pay_first_waiting"
  | "table_ready"
  | "token_ready"
  | "guest_request_service"
  | "guest_request_bill"
  | "ticket_late"
  | "payment_received";

export type ToneKey =
  "new-order" | "ready" | "request" | "attention" | "token-ready" | "success" | "disconnect";

export type VoiceLanguageMode = "EN" | "TA" | "AUTO";
export type DishAnnouncementLevel = "OFF" | "SUMMARY" | "FULL";

export interface DishSummaryItem {
  name: string;
  name_ta?: string;
  qty: number;
}

export interface SoundEvent {
  event_id: string;
  seq?: number;
  event_type: SoundEventType;
  order_id?: string | null;
  service_request_id?: string | null;
  target_label: string;
  token_number?: number | null;
  dishes?: DishSummaryItem[];
  total_items?: number;
  request_type?: string;
  is_recall?: boolean;
  elapsed_minutes?: number | null;
  created_at?: string;
}

export interface EventRulePreference {
  chime: boolean;
  voice: boolean;
  repeat_seconds: number;
  nag?: boolean;
  max_repeats?: number;
}

export interface DeviceSoundPreferences {
  soundEnabled: boolean;
  voiceEnabled: boolean;
  volume: number; // 0.0 - 1.0
  voiceLanguage: VoiceLanguageMode;
  dishAnnouncementLevel: DishAnnouncementLevel;
  speechRate: number; // 0.7 - 1.4
  keepScreenAwake: boolean;
  useRecordedClips: boolean;
  events: Record<SoundEventType, EventRulePreference>;
}

export interface BranchSoundDefaultsResponse {
  branch_id: string;
  voice_language: VoiceLanguageMode;
  dish_announcement_level: DishAnnouncementLevel;
  speech_rate: number;
  events: Record<SoundEventType, EventRulePreference>;
}

export const EVENT_PRIORITY: Record<SoundEventType, number> = {
  ticket_late: 100,
  qr_needs_approval: 95,
  table_ready: 90,
  token_ready: 88,
  guest_request_bill: 80,
  guest_request_service: 78,
  new_order: 70,
  pay_first_waiting: 60,
  payment_received: 30,
};

export const EVENT_TONE_MAP: Record<SoundEventType, ToneKey> = {
  new_order: "new-order",
  qr_needs_approval: "attention",
  pay_first_waiting: "attention",
  table_ready: "ready",
  token_ready: "token-ready",
  guest_request_service: "request",
  guest_request_bill: "request",
  ticket_late: "attention",
  payment_received: "success",
};

export const TONE_FREQUENCIES: Record<
  ToneKey,
  Array<{ freq: number; delay: number; dur: number; type: OscillatorType }>
> = {
  "new-order": [
    { freq: 587.33, delay: 0, dur: 0.18, type: "sine" },
    { freq: 880.0, delay: 0.14, dur: 0.3, type: "sine" },
  ],
  ready: [
    { freq: 523.25, delay: 0, dur: 0.18, type: "triangle" },
    { freq: 659.25, delay: 0.14, dur: 0.18, type: "triangle" },
    { freq: 783.99, delay: 0.28, dur: 0.28, type: "triangle" },
  ],
  request: [
    { freq: 659.25, delay: 0, dur: 0.2, type: "sine" },
    { freq: 987.77, delay: 0.16, dur: 0.3, type: "sine" },
  ],
  attention: [
    { freq: 698.46, delay: 0, dur: 0.14, type: "triangle" },
    { freq: 880.0, delay: 0.16, dur: 0.14, type: "triangle" },
    { freq: 698.46, delay: 0.32, dur: 0.22, type: "triangle" },
  ],
  "token-ready": [
    { freq: 783.99, delay: 0, dur: 0.16, type: "triangle" },
    { freq: 1046.5, delay: 0.13, dur: 0.3, type: "triangle" },
  ],
  success: [
    { freq: 523.25, delay: 0, dur: 0.12, type: "sine" },
    { freq: 783.99, delay: 0.1, dur: 0.22, type: "sine" },
  ],
  disconnect: [
    { freq: 293.66, delay: 0, dur: 0.18, type: "sine" },
    { freq: 246.94, delay: 0.22, dur: 0.24, type: "sine" },
  ],
};

export const DEFAULT_EVENT_PREFERENCES: Record<SoundEventType, EventRulePreference> = {
  new_order: { chime: true, voice: true, repeat_seconds: 60, nag: false },
  qr_needs_approval: { chime: true, voice: true, repeat_seconds: 90, nag: true },
  pay_first_waiting: { chime: true, voice: true, repeat_seconds: 0, nag: false },
  table_ready: { chime: true, voice: true, repeat_seconds: 45, nag: true, max_repeats: 3 },
  token_ready: { chime: true, voice: true, repeat_seconds: 0, nag: false },
  guest_request_service: { chime: true, voice: true, repeat_seconds: 90, nag: true },
  guest_request_bill: { chime: true, voice: true, repeat_seconds: 90, nag: true },
  ticket_late: { chime: true, voice: true, repeat_seconds: 120, nag: true },
  payment_received: { chime: true, voice: false, repeat_seconds: 0, nag: false },
};

export function getDefaultDevicePreferences(): DeviceSoundPreferences {
  return {
    soundEnabled: true,
    voiceEnabled: true,
    volume: 0.8,
    voiceLanguage: "AUTO",
    dishAnnouncementLevel: "SUMMARY",
    speechRate: 1.0,
    keepScreenAwake: false,
    useRecordedClips: false,
    events: {
      new_order: { ...DEFAULT_EVENT_PREFERENCES.new_order },
      qr_needs_approval: { ...DEFAULT_EVENT_PREFERENCES.qr_needs_approval },
      pay_first_waiting: { ...DEFAULT_EVENT_PREFERENCES.pay_first_waiting },
      table_ready: { ...DEFAULT_EVENT_PREFERENCES.table_ready },
      token_ready: { ...DEFAULT_EVENT_PREFERENCES.token_ready },
      guest_request_service: { ...DEFAULT_EVENT_PREFERENCES.guest_request_service },
      guest_request_bill: { ...DEFAULT_EVENT_PREFERENCES.guest_request_bill },
      ticket_late: { ...DEFAULT_EVENT_PREFERENCES.ticket_late },
      payment_received: { ...DEFAULT_EVENT_PREFERENCES.payment_received },
    },
  };
}
