// Sound alerts and speech synthesis utility for new orders and waiter calls

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const STORAGE_KEY_SOUND = "smf_sound_enabled";
const STORAGE_KEY_VOICE = "smf_voice_enabled";
const STORAGE_KEY_VOLUME = "smf_sound_volume";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(STORAGE_KEY_SOUND);
  return stored === null ? true : stored === "true";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_SOUND, String(enabled));
}

export function isVoiceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(STORAGE_KEY_VOICE);
  return stored === null ? true : stored === "true";
}

export function setVoiceEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_VOICE, String(enabled));
}

export function getSoundVolume(): number {
  if (typeof window === "undefined") return 0.7;
  const stored = localStorage.getItem(STORAGE_KEY_VOLUME);
  if (!stored) return 0.7;
  const parsed = parseFloat(stored);
  return isNaN(parsed) ? 0.7 : Math.min(1, Math.max(0, parsed));
}

export function setSoundVolume(volume: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_VOLUME, String(Math.min(1, Math.max(0, volume))));
}

/**
 * Plays a pleasant dual-tone restaurant chime using the Web Audio API.
 */
export function playChime(frequency1 = 587.33, frequency2 = 880.0, duration = 0.45): void {
  if (!isSoundEnabled() || typeof window === "undefined") return;

  try {
    const AudioCtxClass =
      window.AudioContext || (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioCtxClass) return;

    const audioCtx = new AudioCtxClass();
    const volume = getSoundVolume();

    // First tone
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(frequency1, audioCtx.currentTime);
    gain1.gain.setValueAtTime(volume * 0.4, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration * 0.5);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start();
    osc1.stop(audioCtx.currentTime + duration * 0.5);

    // Second higher tone
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(frequency2, audioCtx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0, audioCtx.currentTime);
    gain2.gain.setValueAtTime(volume * 0.5, audioCtx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(audioCtx.currentTime + 0.12);
    osc2.stop(audioCtx.currentTime + duration);
  } catch {
    // AudioContext blocked or not supported
  }
}

/**
 * Announces a voice message using Web Speech API if enabled.
 */
export function speakText(text: string): void {
  if (!isSoundEnabled() || !isVoiceEnabled() || typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;

  try {
    window.speechSynthesis.cancel(); // Stop prior speeches
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.1;
    utterance.volume = getSoundVolume();
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis error or blocked
  }
}

/**
 * Triggers audio alert and voice announcement for a newly received order.
 */
export function playOrderAlert(tableOrTarget?: string): void {
  playChime(587.33, 880.0, 0.5); // D5 -> A5
  if (tableOrTarget) {
    setTimeout(() => {
      speakText(`New order for ${tableOrTarget}`);
    }, 400);
  }
}

/**
 * Triggers audio alert for digital waiter call.
 */
export function playWaiterCallAlert(tableOrTarget?: string): void {
  playChime(659.25, 987.77, 0.6); // E5 -> B5 (gentle bell)
  if (tableOrTarget) {
    setTimeout(() => {
      speakText(`Service call from ${tableOrTarget}`);
    }, 450);
  }
}

/**
 * Triggers a 3-note ascending chime (C5 -> E5 -> G5) when an order is ready for pickup/serving.
 */
export function playReadyAlert(
  targetOrToken?: string,
  options?: { bypassMuteSetting?: boolean; withVoice?: boolean }
): void {
  if (typeof window === "undefined") return;
  if (!options?.bypassMuteSetting && !isSoundEnabled()) return;

  try {
    const AudioCtxClass =
      window.AudioContext || (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioCtxClass) return;

    const audioCtx = new AudioCtxClass();
    if (audioCtx.state === "suspended" && typeof audioCtx.resume === "function") {
      audioCtx.resume().catch(() => {});
    }
    const volume = getSoundVolume();
    const notes = [523.25, 659.25, 783.99]; // C5 -> E5 -> G5

    notes.forEach((freq, idx) => {
      const startTime = audioCtx.currentTime + idx * 0.12;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(volume * 0.45, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.24);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.24);
    });
  } catch {
    // AudioContext blocked or not supported
  }

  if (options?.withVoice && targetOrToken) {
    setTimeout(() => {
      speakText(`Order ready for ${targetOrToken}`);
    }, 450);
  }
}

/**
 * Test button helper for settings or sound toggle.
 */
export function testSoundAlert(): void {
  playOrderAlert("Table 1");
}
