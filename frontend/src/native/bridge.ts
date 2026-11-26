import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";

const REFRESH_KEY = "smf_native_refresh_token";
const DEVICE_ID_KEY = "smf_native_device_id";
const EXPLAINER_SEEN_KEY = "smf_native_explainer_seen";

export interface NativeTestShim {
  secureStorage?: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    remove: (key: string) => Promise<void>;
  };
  appVersionCode?: number;
  appVersionName?: string;
}

declare global {
  interface Window {
    __SMF_NATIVE_SHIM__?: NativeTestShim;
  }
}

export function isNativeApp(): boolean {
  if (typeof window !== "undefined" && window.__SMF_NATIVE_SHIM__) {
    return true;
  }
  if (import.meta.env.VITE_NATIVE === "1") {
    return true;
  }
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getApiBaseUrl(): string {
  if (isNativeApp()) {
    const raw = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
    if (raw) {
      return `${raw}/api/v1`;
    }
  }
  return "/api/v1";
}

async function secureGet(key: string): Promise<string | null> {
  if (typeof window !== "undefined" && window.__SMF_NATIVE_SHIM__?.secureStorage) {
    return window.__SMF_NATIVE_SHIM__.secureStorage.get(key);
  }
  try {
    const val = await SecureStorage.get(key);
    return typeof val === "string" ? val : null;
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (typeof window !== "undefined" && window.__SMF_NATIVE_SHIM__?.secureStorage) {
    await window.__SMF_NATIVE_SHIM__.secureStorage.set(key, value);
    return;
  }
  await SecureStorage.set(key, value);
}

async function secureRemove(key: string): Promise<void> {
  if (typeof window !== "undefined" && window.__SMF_NATIVE_SHIM__?.secureStorage) {
    await window.__SMF_NATIVE_SHIM__.secureStorage.remove(key);
    return;
  }
  try {
    await SecureStorage.remove(key);
  } catch {
    // Ignore missing key
  }
}

export const nativeTokenStorage = {
  getRefreshToken: () => secureGet(REFRESH_KEY),
  setRefreshToken: (token: string) => secureSet(REFRESH_KEY, token),
  clearRefreshToken: () => secureRemove(REFRESH_KEY),
};

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await secureGet(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `and-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await secureSet(DEVICE_ID_KEY, generated);
  return generated;
}

export async function getInstalledAppVersion(): Promise<{ code: number; name: string }> {
  if (typeof window !== "undefined" && window.__SMF_NATIVE_SHIM__) {
    return {
      code: window.__SMF_NATIVE_SHIM__.appVersionCode ?? 1,
      name: window.__SMF_NATIVE_SHIM__.appVersionName ?? "1.10.0",
    };
  }
  try {
    const info = await CapApp.getInfo();
    return {
      code: Number.parseInt(info.build || "1", 10) || 1,
      name: info.version || "1.10.0",
    };
  } catch {
    return { code: 1, name: "1.10.0" };
  }
}

export async function setNativeKeepAwake(enabled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (enabled) {
      await KeepAwake.keepAwake();
    } else {
      await KeepAwake.allowSleep();
    }
  } catch {
    // Ignore on non-native environments
  }
}

export function hasSeenNativeExplainer(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(EXPLAINER_SEEN_KEY) === "1";
}

export function markNativeExplainerSeen(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(EXPLAINER_SEEN_KEY, "1");
  }
}

export async function initNativeShell(handlers: {
  onResume: () => void;
  onBackButton: (canGoBack: boolean) => void;
}): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) {
    return () => undefined;
  }

  try {
    await StatusBar.setBackgroundColor({ color: "#0B1F3B" });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // Ignore if unavailable
  }

  try {
    await SplashScreen.hide();
  } catch {
    // Ignore
  }

  const stateHandle = await CapApp.addListener("appStateChange", ({ isActive }) => {
    if (isActive) {
      handlers.onResume();
    }
  });

  const backHandle = await CapApp.addListener("backButton", ({ canGoBack }) => {
    handlers.onBackButton(canGoBack);
  });

  return () => {
    void stateHandle.remove();
    void backHandle.remove();
  };
}
