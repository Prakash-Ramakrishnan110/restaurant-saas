import { soundEngine } from "../sound/engine";
import { ToneKey } from "../sound/types";

export function isSoundEnabled(): boolean {
  return soundEngine.getPreferences().soundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEngine.updatePreferences({ soundEnabled: enabled });
}

export function isVoiceEnabled(): boolean {
  return soundEngine.getPreferences().voiceEnabled;
}

export function setVoiceEnabled(enabled: boolean): void {
  soundEngine.updatePreferences({ voiceEnabled: enabled });
}

export function getSoundVolume(): number {
  return soundEngine.getPreferences().volume;
}

export function setSoundVolume(volume: number): void {
  soundEngine.updatePreferences({ volume: Math.min(1, Math.max(0, volume)) });
}

function resolveToneKeyForFrequency(frequency1: number, frequency2: number): ToneKey {
  if (frequency1 >= 640 && frequency2 >= 950) return "request";
  if (frequency1 <= 530) return "ready";
  return "new-order";
}

/**
 * Plays a short chime routed through the central sound engine.
 */
export function playChime(frequency1 = 587.33, frequency2 = 880.0, _duration = 0.45): void {
  if (!isSoundEnabled()) return;
  soundEngine.playTone(resolveToneKeyForFrequency(frequency1, frequency2));
}

/**
 * Announces a short phrase via the central sound engine / SpeechSynthesis.
 */
export function speakText(
  text: string,
  lang: "en-US" | "ta-IN" = "en-US",
  bypassMuteSetting = false
): void {
  if (typeof window === "undefined") return;
  if (!bypassMuteSetting && (!isSoundEnabled() || !isVoiceEnabled())) return;
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = soundEngine.getPreferences().speechRate || 1.0;
    utterance.pitch = 1.05;
    utterance.volume = getSoundVolume();
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis unavailable or blocked
  }
}

/**
 * Triggers audio alert and voice announcement for a newly received order.
 */
export function playOrderAlert(tableOrTarget?: string): void {
  playChime(587.33, 880.0, 0.5);
  if (tableOrTarget) {
    setTimeout(() => {
      speakText(`New order for ${tableOrTarget}`);
    }, 350);
  }
}

/**
 * Triggers audio alert for digital waiter call.
 */
export function playWaiterCallAlert(tableOrTarget?: string): void {
  playChime(659.25, 987.77, 0.6);
  if (tableOrTarget) {
    setTimeout(() => {
      speakText(`Service call from ${tableOrTarget}`);
    }, 350);
  }
}

/**
 * Triggers the ascending ready chime (and optional speech) via the central sound engine.
 */
export function playReadyAlert(
  targetOrToken?: string,
  options?: { bypassMuteSetting?: boolean; withVoice?: boolean }
): void {
  if (typeof window === "undefined") return;
  if (!options?.bypassMuteSetting && !isSoundEnabled()) return;

  soundEngine.playTone("ready", { preferSynth: !soundEngine.isUnlocked() });

  if (options?.withVoice && targetOrToken) {
    setTimeout(() => {
      speakText(`Order ready for ${targetOrToken}`, "en-US", Boolean(options?.bypassMuteSetting));
    }, 380);
  }
}

/**
 * Announces a counter token call with chime + EN/TA SpeechSynthesis routed via sound engine.
 */
export function playTokenCallAlert(
  tokenNumber: number,
  lang: "EN" | "TA" = "EN",
  options?: { bypassMuteSetting?: boolean; withVoice?: boolean }
): void {
  if (typeof window === "undefined") return;
  if (!options?.bypassMuteSetting && !isSoundEnabled()) return;

  soundEngine.playTone("token-ready");
  if (options?.withVoice !== false) {
    const phrase =
      lang === "TA"
        ? `டோக்கன் எண் ${tokenNumber}, கவுண்டரில் தயார்`
        : `Token number ${tokenNumber}, ready at counter`;
    const speechLang = lang === "TA" ? "ta-IN" : "en-US";
    setTimeout(() => {
      speakText(phrase, speechLang, Boolean(options?.bypassMuteSetting));
    }, 380);
  }
}

/**
 * Test button helper for settings or sound toggle.
 */
export function testSoundAlert(): void {
  void soundEngine.unlock();
  playOrderAlert("Table 1");
}
