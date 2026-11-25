import {
  composeAnnouncementText,
  composeBurstSummaryText,
  composeEventClips,
  detectAvailableVoices,
  resolveSpeechLanguage,
} from "./composer";
import {
  DeviceSoundPreferences,
  EVENT_PRIORITY,
  EVENT_TONE_MAP,
  getDefaultDevicePreferences,
  SoundEvent,
  SoundEventType,
  TONE_FREQUENCIES,
  ToneKey,
} from "./types";

const STORAGE_KEYS = {
  SOUND_ENABLED: "smf_sound_enabled",
  VOICE_ENABLED: "smf_voice_enabled",
  VOLUME: "smf_sound_volume",
  PREFS_JSON: "smf_sound_prefs_v3",
};

const MAX_QUEUE_SIZE = 5;
const MAX_SEEN_IDS = 500;
const BURST_WINDOW_MS = 5000;
const MAX_SPEECH_DURATION_MS = 12000;

interface QueuedSoundItem {
  event: SoundEvent;
  priority: number;
  enqueuedAt: number;
  isSummary?: boolean;
  summaryText?: string;
}

export interface EngineVisualAlert {
  id: string;
  eventType: SoundEventType | "disconnect";
  message: string;
  escalated?: boolean;
  timestamp: number;
}

export interface SoundEngineSnapshot {
  unlocked: boolean;
  preferences: DeviceSoundPreferences;
  latestAlert: EngineVisualAlert | null;
  queueLength: number;
}

interface RepeatHandle {
  timerId: number;
  count: number;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

interface WakeLockSupport {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
}

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export function loadDeviceSoundPreferences(): DeviceSoundPreferences {
  const defaults = getDefaultDevicePreferences();
  if (typeof window === "undefined") return defaults;

  try {
    const rawJson = localStorage.getItem(STORAGE_KEYS.PREFS_JSON);
    if (rawJson) {
      const parsed = JSON.parse(rawJson) as Partial<DeviceSoundPreferences>;
      return {
        ...defaults,
        ...parsed,
        events: {
          ...defaults.events,
          ...(parsed.events || {}),
        },
      };
    }
  } catch {
    // fallback to legacy scalar keys
  }

  const enabled = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
  const voice = localStorage.getItem(STORAGE_KEYS.VOICE_ENABLED);
  const vol = localStorage.getItem(STORAGE_KEYS.VOLUME);
  if (enabled !== null) defaults.soundEnabled = enabled === "true";
  if (voice !== null) defaults.voiceEnabled = voice === "true";
  if (vol !== null && !Number.isNaN(parseFloat(vol))) {
    const v = parseFloat(vol);
    defaults.volume = v > 1 ? Math.min(1, v / 100) : Math.max(0, Math.min(1, v));
  }
  return defaults;
}

export function saveDeviceSoundPreferences(prefs: DeviceSoundPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(prefs.soundEnabled));
  localStorage.setItem(STORAGE_KEYS.VOICE_ENABLED, String(prefs.voiceEnabled));
  localStorage.setItem(STORAGE_KEYS.VOLUME, String(prefs.volume));
  localStorage.setItem(STORAGE_KEYS.PREFS_JSON, JSON.stringify(prefs));
}

export class SoundEngine {
  private prefs: DeviceSoundPreferences;
  private unlocked = false;
  private queue: QueuedSoundItem[] = [];
  private processing = false;
  private seenIds: string[] = [];
  private seenSet = new Set<string>();
  private recentByType = new Map<SoundEventType, number[]>();
  private repeats = new Map<string, RepeatHandle>();
  private latestAlert: EngineVisualAlert | null = null;
  private subscribers = new Set<(snap: SoundEngineSnapshot) => void>();
  private audioCache = new Map<string, HTMLAudioElement>();
  private wakeLockSentinel: WakeLockSentinelLike | null = null;
  private speechStopTimer: number | null = null;

  constructor() {
    this.prefs = loadDeviceSoundPreferences();
  }

  getSnapshot(): SoundEngineSnapshot {
    return {
      unlocked: this.unlocked,
      preferences: this.prefs,
      latestAlert: this.latestAlert,
      queueLength: this.queue.length,
    };
  }

  subscribe(fn: (snap: SoundEngineSnapshot) => void): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.subscribers.forEach((cb) => cb(snap));
  }

  getPreferences(): DeviceSoundPreferences {
    return this.prefs;
  }

  updatePreferences(partial: Partial<DeviceSoundPreferences>): void {
    this.prefs = {
      ...this.prefs,
      ...partial,
      events: {
        ...this.prefs.events,
        ...(partial.events || {}),
      },
    };
    saveDeviceSoundPreferences(this.prefs);
    if (this.prefs.keepScreenAwake) {
      this.acquireWakeLock().catch(() => {});
    } else {
      this.releaseWakeLock().catch(() => {});
    }
    this.emit();
  }

  async unlock(): Promise<void> {
    this.unlocked = true;
    this.prefs.soundEnabled = true;
    saveDeviceSoundPreferences(this.prefs);

    if (typeof window !== "undefined") {
      try {
        const AudioCtx =
          window.AudioContext || (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === "suspended" && typeof ctx.resume === "function") {
            await ctx.resume();
          }
        }
      } catch {
        // Ignore AudioContext error in restricted envs
      }

      // Preload short sound kit
      if (typeof Audio !== "undefined") {
        (["new-order", "ready", "request", "attention", "token-ready", "success"] as const).forEach(
          (name) => {
            if (!this.audioCache.has(name)) {
              try {
                const a = new Audio(`/sound/${name}.wav`);
                a.preload = "auto";
                this.audioCache.set(name, a);
              } catch {
                // ignore
              }
            }
          }
        );
      }
    }

    this.emit();
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  private markSeen(eventId: string): boolean {
    if (this.seenSet.has(eventId)) return false;
    this.seenSet.add(eventId);
    this.seenIds.push(eventId);
    if (this.seenIds.length > MAX_SEEN_IDS) {
      const oldest = this.seenIds.shift();
      if (oldest) this.seenSet.delete(oldest);
    }
    return true;
  }

  enqueue(event: SoundEvent, options?: { bypassMute?: boolean; forceSpeech?: boolean }): boolean {
    if (!this.markSeen(event.event_id)) return false;

    const now = Date.now();
    const history = (this.recentByType.get(event.event_type) || []).filter(
      (ts) => now - ts <= BURST_WINDOW_MS
    );
    history.push(now);
    this.recentByType.set(event.event_type, history);

    // Coalesce burst (>3 of same type within 5 seconds) into summary announcement
    if (history.length > 3) {
      // Remove extra queued items of same type & queue single summary
      this.queue = this.queue.filter((q) => q.event.event_type !== event.event_type);
      const detected = detectAvailableVoices();
      const lang = resolveSpeechLanguage(
        this.prefs.voiceLanguage,
        typeof navigator !== "undefined" ? navigator.language : "en",
        detected.hasTamilVoice
      );
      const summary = composeBurstSummaryText(event.event_type, history.length, lang);
      this.insertPriority({
        event,
        priority: EVENT_PRIORITY[event.event_type] ?? 50,
        enqueuedAt: now,
        isSummary: true,
        summaryText: summary,
      });
    } else {
      this.insertPriority({
        event,
        priority: EVENT_PRIORITY[event.event_type] ?? 50,
        enqueuedAt: now,
      });
    }

    this.processNext(options);
    return true;
  }

  /**
   * Handles reconnected event batches: announces at most 3 and appends a summary for remaining events.
   */
  enqueueBatch(events: SoundEvent[], options?: { isReconnect?: boolean }): void {
    const fresh = events.filter((e) => !this.seenSet.has(e.event_id));
    if (fresh.length === 0) return;

    if (options?.isReconnect && fresh.length > 3) {
      const head = fresh.slice(0, 3);
      const tail = fresh.slice(3);
      head.forEach((ev) => this.enqueue(ev));
      tail.forEach((ev) => this.markSeen(ev.event_id));

      const detected = detectAvailableVoices();
      const lang = resolveSpeechLanguage(
        this.prefs.voiceLanguage,
        typeof navigator !== "undefined" ? navigator.language : "en",
        detected.hasTamilVoice
      );
      const summary = composeBurstSummaryText(tail[0].event_type, tail.length, lang);
      this.insertPriority({
        event: {
          ...tail[0],
          event_id: `reconnect-summary-${Date.now()}`,
        },
        priority: 65,
        enqueuedAt: Date.now(),
        isSummary: true,
        summaryText: summary,
      });
      this.processNext();
      return;
    }

    fresh.forEach((ev) => this.enqueue(ev));
  }

  private insertPriority(item: QueuedSoundItem): void {
    this.queue.push(item);
    this.queue.sort((a, b) => b.priority - a.priority || a.enqueuedAt - b.enqueuedAt);
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(0, MAX_QUEUE_SIZE);
    }
  }

  private processNext(options?: { bypassMute?: boolean; forceSpeech?: boolean }): void {
    if (this.processing || this.queue.length === 0) return;
    const next = this.queue.shift();
    if (!next) return;

    this.processing = true;
    const { event } = next;
    const rule = this.prefs.events[event.event_type];
    const allowSound = Boolean(options?.bypassMute || this.prefs.soundEnabled);
    const shouldChime = allowSound && (options?.bypassMute || rule?.chime !== false);
    const shouldVoice =
      allowSound && (options?.forceSpeech || (this.prefs.voiceEnabled && rule?.voice !== false));

    const spokenText =
      next.isSummary && next.summaryText
        ? next.summaryText
        : composeAnnouncementText(event, {
            voiceLanguage: this.prefs.voiceLanguage,
            uiLang: typeof navigator !== "undefined" ? navigator.language : "en",
            dishAnnouncementLevel: this.prefs.dishAnnouncementLevel,
          });

    this.latestAlert = {
      id: event.event_id,
      eventType: event.event_type,
      message: spokenText,
      timestamp: Date.now(),
    };
    this.emit();

    const toneKey = EVENT_TONE_MAP[event.event_type] || "new-order";
    if (shouldChime) {
      this.playTone(toneKey);
    }

    if (shouldVoice && spokenText) {
      this.scheduleRepeatIfConfigured(event);
      this.playVoiceWithFallback(event, spokenText, () => {
        this.processing = false;
        if (this.queue.length > 0) this.processNext(options);
      });
    } else {
      this.scheduleRepeatIfConfigured(event);
      this.processing = false;
      if (this.queue.length > 0) this.processNext(options);
    }
  }

  playTone(toneKey: ToneKey, options?: { preferSynth?: boolean }): void {
    if (typeof window === "undefined") return;

    // 1. Try preloaded WAV / Audio element for the 6 kit chimes
    if (!options?.preferSynth && toneKey !== "disconnect" && typeof Audio !== "undefined") {
      try {
        const audio = this.audioCache.get(toneKey) || new Audio(`/sound/${toneKey}.wav`);
        audio.volume = this.prefs.volume;
        audio.currentTime = 0;
        const p = audio.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => this.playSynthFallback(toneKey));
        }
        return;
      } catch {
        // Fallback to Web Audio synthesizer
      }
    }
    this.playSynthFallback(toneKey);
  }

  private playSynthFallback(toneKey: ToneKey): void {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended" && typeof ctx.resume === "function") {
        ctx.resume().catch(() => {});
      }
      const notes = TONE_FREQUENCIES[toneKey] || TONE_FREQUENCIES["new-order"];
      notes.forEach((n) => {
        const start = ctx.currentTime + n.delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = n.type;
        osc.frequency.setValueAtTime(n.freq, start);
        gain.gain.setValueAtTime(Math.max(0.05, this.prefs.volume * 0.45), start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + n.dur);
      });
    } catch {
      // Headless / unavailable
    }
  }

  private playVoiceWithFallback(event: SoundEvent, text: string, onDone: () => void): void {
    if (typeof window === "undefined") {
      onDone();
      return;
    }

    const detected = detectAvailableVoices();
    const lang = resolveSpeechLanguage(
      this.prefs.voiceLanguage,
      typeof navigator !== "undefined" ? navigator.language : "en",
      detected.hasTamilVoice
    );

    // 1. Optional recorded clips chain -> falls back cleanly if unavailable
    if (this.prefs.useRecordedClips && typeof Audio !== "undefined") {
      const clips = composeEventClips(event, lang);
      if (clips.length > 0) {
        this.playClipSequence(
          clips,
          () => onDone(),
          () => {
            this.speakWithSynthesis(text, lang, onDone);
          }
        );
        return;
      }
    }

    // 2. SpeechSynthesis fallback -> 3. Chime-only fallback (no crash)
    this.speakWithSynthesis(text, lang, onDone);
  }

  private playClipSequence(clips: string[], onDone: () => void, onError: () => void): void {
    if (clips.length === 0) {
      onDone();
      return;
    }
    const [head, ...rest] = clips;
    try {
      const a = new Audio(head);
      a.volume = this.prefs.volume;
      a.onended = () => this.playClipSequence(rest, onDone, onError);
      a.onerror = () => onError();
      const p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => onError());
      }
    } catch {
      onError();
    }
  }

  private speakWithSynthesis(text: string, lang: "en" | "ta", onDone: () => void): void {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      onDone();
      return;
    }
    try {
      if (this.speechStopTimer !== null) {
        window.clearTimeout(this.speechStopTimer);
      }
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = this.prefs.speechRate;
      utt.volume = this.prefs.volume;
      utt.lang = lang === "ta" ? "ta-IN" : "en-US";
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (this.speechStopTimer !== null) {
          window.clearTimeout(this.speechStopTimer);
          this.speechStopTimer = null;
        }
        onDone();
      };
      utt.onend = finish;
      utt.onerror = finish;
      // Guarantee 12s max cap
      this.speechStopTimer = window.setTimeout(() => {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
        finish();
      }, MAX_SPEECH_DURATION_MS);
      window.speechSynthesis.speak(utt);
    } catch {
      onDone();
    }
  }

  private scheduleRepeatIfConfigured(event: SoundEvent): void {
    if (typeof window === "undefined") return;
    const rule = this.prefs.events[event.event_type];
    if (!rule || !rule.repeat_seconds || rule.repeat_seconds <= 0 || rule.nag === false) {
      return;
    }
    const key = event.order_id || event.service_request_id || event.event_id;
    if (this.repeats.has(key)) return;

    const maxRepeats = rule.max_repeats ?? 3;
    const handle: RepeatHandle = {
      count: 0,
      timerId: window.setInterval(() => {
        handle.count += 1;
        if (handle.count > maxRepeats) {
          this.clearRepeat(key);
          this.latestAlert = {
            id: `${event.event_id}-esc`,
            eventType: event.event_type,
            message: `Manager alert: ${event.target_label} unacknowledged`,
            escalated: true,
            timestamp: Date.now(),
          };
          this.emit();
          return;
        }
        this.playTone(EVENT_TONE_MAP[event.event_type] || "attention");
        if (this.prefs.voiceEnabled && rule.voice) {
          const text = composeAnnouncementText(event, {
            voiceLanguage: this.prefs.voiceLanguage,
            uiLang: typeof navigator !== "undefined" ? navigator.language : "en",
            dishAnnouncementLevel: this.prefs.dishAnnouncementLevel,
          });
          this.speakWithSynthesis(text, "en", () => {});
        }
      }, rule.repeat_seconds * 1000),
    };
    this.repeats.set(key, handle);
  }

  clearRepeat(entityId: string): void {
    const h = this.repeats.get(entityId);
    if (h) {
      window.clearInterval(h.timerId);
      this.repeats.delete(entityId);
    }
  }

  clearAllRepeats(): void {
    this.repeats.forEach((h) => window.clearInterval(h.timerId));
    this.repeats.clear();
  }

  playDisconnectTone(): void {
    this.latestAlert = {
      id: `disconnect-${Date.now()}`,
      eventType: "disconnect",
      message: "Connection lost. Live audio alerts paused.",
      timestamp: Date.now(),
    };
    if (this.prefs.soundEnabled) {
      this.playSynthFallback("disconnect");
    }
    this.emit();
  }

  async acquireWakeLock(): Promise<boolean> {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as unknown as WakeLockSupport;
    if (!nav.wakeLock || typeof nav.wakeLock.request !== "function") return false;
    try {
      this.wakeLockSentinel = await nav.wakeLock.request("screen");
      return true;
    } catch {
      return false;
    }
  }

  async releaseWakeLock(): Promise<void> {
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch {
        // ignore
      }
      this.wakeLockSentinel = null;
    }
  }
}

export const soundEngine = new SoundEngine();

export function createSoundEngine(): SoundEngine {
  return new SoundEngine();
}
