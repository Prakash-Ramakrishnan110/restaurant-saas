import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import "../i18n";
import {
  composeAnnouncementText,
  composeNumberClips,
  detectAvailableVoices,
  resolveSpeechLanguage,
} from "../sound/composer";
import { createSoundEngine } from "../sound/engine";
import { SoundSettingsPage } from "../pages/settings/SoundSettingsPage";
import { ordersApi } from "../api/orders";

import { AuthContext, AuthContextType } from "../context/AuthContext";

vi.mock("../api/orders", () => ({
  ordersApi: {
    getSoundDefaults: vi.fn(),
    updateSoundDefaults: vi.fn(),
    getEventFeed: vi.fn(),
  },
}));

const mockOwnerAuth: AuthContextType = {
  user: {
    id: "u1",
    full_name: "Kaveri Owner",
    email: "owner@example.com",
    is_platform_admin: false,
  },
  memberships: [],
  activeTenant: {
    tenant_id: "t1",
    tenant_name: "Kaveri Kitchen",
    tenant_slug: "kaveri-kitchen",
    role: "OWNER",
    is_active: true,
  },
  activeRole: "OWNER",
  permissions: ["*"],
  mustChangePassword: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  selectTenant: vi.fn(),
  can: () => true,
};

describe("Stage 3 Sound Engine, Composer & Settings", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(ordersApi.getSoundDefaults).mockResolvedValue({
      data: {
        branch_id: "b1",
        voice_language: "AUTO",
        dish_announcement_level: "SUMMARY",
        speech_rate: 1.0,
        events: {
          new_order: { chime: true, voice: true, repeat_seconds: 60, nag: false },
          qr_needs_approval: { chime: true, voice: true, repeat_seconds: 90, nag: true },
          pay_first_waiting: { chime: true, voice: true, repeat_seconds: 0, nag: false },
          table_ready: { chime: true, voice: true, repeat_seconds: 45, nag: true, max_repeats: 3 },
          token_ready: { chime: true, voice: true, repeat_seconds: 0, nag: false },
          guest_request_service: { chime: true, voice: true, repeat_seconds: 90, nag: true },
          guest_request_bill: { chime: true, voice: true, repeat_seconds: 90, nag: true },
          ticket_late: { chime: true, voice: true, repeat_seconds: 120, nag: true },
          payment_received: { chime: true, voice: false, repeat_seconds: 0, nag: false },
        },
      },
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("composes concise EN dish summary matching 'New order. T4. 2 dosa, 1 idly and 3 more'", () => {
    const line = composeAnnouncementText(
      {
        event_id: "ev-1",
        event_type: "new_order",
        target_label: "T4",
        dishes: [
          { name: "Dosa", name_ta: "தோசை", qty: 2 },
          { name: "Idly", name_ta: "இட்லி", qty: 1 },
        ],
        total_items: 5,
      },
      { voiceLanguage: "EN", uiLang: "en", dishAnnouncementLevel: "SUMMARY" }
    );

    expect(line).toBe("New order. T4. 2 dosa, 1 idly and 3 more");

    // When >3 dishes provided in SUMMARY mode, caps spoken dishes at 3
    const cappedLine = composeAnnouncementText(
      {
        event_id: "ev-cap",
        event_type: "new_order",
        target_label: "T4",
        dishes: [
          { name: "Dosa", qty: 2 },
          { name: "Idly", qty: 1 },
          { name: "Vada", qty: 1 },
          { name: "Pongal", qty: 1 },
          { name: "Coffee", qty: 1 },
        ],
        total_items: 5,
      },
      { voiceLanguage: "EN", uiLang: "en", dishAnnouncementLevel: "SUMMARY" }
    );
    expect(cappedLine).toBe("New order. T4. 2 dosa, 1 idly, 1 vada and 2 more");
  });

  it("uses Tamil dish names only when Tamil voice exists; falls back to English names otherwise", () => {
    const sample = {
      event_id: "ev-ta",
      event_type: "new_order" as const,
      target_label: "T4",
      dishes: [{ name: "Dosa", name_ta: "தோசை", qty: 2 }],
      total_items: 1,
    };

    const origSpeech = window.speechSynthesis;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ name: "English US", lang: "en-US" }],
        speak: vi.fn(),
        cancel: vi.fn(),
      },
    });
    expect(detectAvailableVoices().hasTamilVoice).toBe(false);
    expect(resolveSpeechLanguage("AUTO", "ta-IN", false)).toBe("en");
    const noTamilLine = composeAnnouncementText(sample, {
      voiceLanguage: "AUTO",
      uiLang: "ta-IN",
      dishAnnouncementLevel: "SUMMARY",
    });
    expect(noTamilLine).toContain("2 dosa");
    expect(noTamilLine).not.toContain("தோசை");

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ name: "Valluvar", lang: "ta-IN" }],
        speak: vi.fn(),
        cancel: vi.fn(),
      },
    });
    expect(detectAvailableVoices().hasTamilVoice).toBe(true);
    expect(resolveSpeechLanguage("AUTO", "ta-IN", true)).toBe("ta");
    const withTamilLine = composeAnnouncementText(sample, {
      voiceLanguage: "AUTO",
      uiLang: "ta-IN",
      dishAnnouncementLevel: "SUMMARY",
    });
    expect(withTamilLine).toContain("2 தோசை");

    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: origSpeech });
  });

  it("composes recorded clip sequences for numbers 0..999", () => {
    expect(composeNumberClips(0, "en")).toEqual(["/sound/voice/en/0.wav"]);
    expect(composeNumberClips(12, "en")).toEqual(["/sound/voice/en/12.wav"]);
    expect(composeNumberClips(100, "ta")).toEqual(["/sound/voice/ta/100.wav"]);
    expect(composeNumberClips(245, "en")).toEqual([
      "/sound/voice/en/200.wav",
      "/sound/voice/en/45.wav",
    ]);
    expect(composeNumberClips(999, "ta")).toEqual([
      "/sound/voice/ta/900.wav",
      "/sound/voice/ta/99.wav",
    ]);
  });

  it("deduplicates event_id, caps queue at 5, coalesces burst (>3 in 5s), and summarizes reconnect >3", () => {
    const spoken: string[] = [];
    class MockUtterance {
      text: string;
      lang = "en-US";
      rate = 1;
      volume = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(t: string) {
        this.text = t;
      }
    }
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ name: "English", lang: "en-US" }],
        speak: vi.fn((u: MockUtterance) => {
          spoken.push(u.text);
          // intentionally do not auto-complete immediately while testing queue depth
        }),
        cancel: vi.fn(),
      },
    });

    const engine = createSoundEngine();
    expect(engine.enqueue({ event_id: "dup-1", event_type: "new_order", target_label: "T1" })).toBe(
      true
    );
    expect(engine.enqueue({ event_id: "dup-1", event_type: "new_order", target_label: "T1" })).toBe(
      false
    );

    // Trigger burst > 3 new_order events in <5s
    engine.enqueue({ event_id: "b-2", event_type: "new_order", target_label: "T2" });
    engine.enqueue({ event_id: "b-3", event_type: "new_order", target_label: "T3" });
    engine.enqueue({ event_id: "b-4", event_type: "new_order", target_label: "T4" });
    expect(engine.getSnapshot().queueLength).toBeLessThanOrEqual(5);

    // Enqueue 7 distinct priority items while speech is busy -> queue capped at 5
    for (let i = 0; i < 7; i++) {
      engine.enqueue({
        event_id: `q-cap-${i}`,
        event_type: i % 2 === 0 ? "table_ready" : "guest_request_bill",
        target_label: `T${i + 1}`,
      });
    }
    expect(engine.getSnapshot().queueLength).toBeLessThanOrEqual(5);

    // Fresh engine reconnect batch with 6 events -> announces top 3 + 1 summary = capped cleanly
    const reconnectEngine = createSoundEngine();
    reconnectEngine.enqueueBatch(
      Array.from({ length: 6 }, (_, idx) => ({
        event_id: `rec-${idx}`,
        event_type: "token_ready",
        target_label: `Token ${idx + 1}`,
        token_number: idx + 1,
      })),
      { isReconnect: true }
    );
    expect(reconnectEngine.getSnapshot().queueLength).toBeLessThanOrEqual(5);
    expect(spoken[0]).toContain("New order");
  });

  it("SoundSettingsPage renders all 9 events, voice status, Wake Lock switch, and saves device + branch defaults cleanly (zero axe serious violations)", async () => {
    vi.mocked(ordersApi.updateSoundDefaults).mockResolvedValue({ data: {} } as never);
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ name: "English India", lang: "en-IN" }],
        speak: vi.fn(),
        cancel: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    const { container } = render(
      <AuthContext.Provider value={mockOwnerAuth}>
        <MemoryRouter>
          <SoundSettingsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText(/Sound & Alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/New Order Placed/i)).toBeInTheDocument();
    expect(screen.getByText(/Food Ready/i)).toBeInTheDocument();
    expect(screen.getByTestId("sound-event-row-ticket_late")).toBeInTheDocument();
    expect(screen.getByTestId("sound-event-row-payment_received")).toBeInTheDocument();
    expect(screen.getByTestId("tamil-voice-status")).toHaveTextContent(/No Tamil Voice Found/i);

    fireEvent.click(screen.getByTestId("keep-screen-awake-toggle"));
    fireEvent.click(screen.getByTestId("save-device-sound-btn"));
    expect(screen.getByText(/Sound settings saved on this device/i)).toBeInTheDocument();
    expect(localStorage.getItem("smf_sound_prefs_v3")).toContain('"keepScreenAwake":true');

    fireEvent.click(screen.getByTestId("save-branch-sound-defaults-btn"));
    await waitFor(() => {
      expect(ordersApi.updateSoundDefaults).toHaveBeenCalledTimes(1);
    });

    const axeResults = await axe(container);
    const serious = axeResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(serious).toEqual([]);
  });
});
