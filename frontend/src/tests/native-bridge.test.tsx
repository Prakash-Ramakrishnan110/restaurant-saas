import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getApiBaseUrl, isNativeApp, nativeTokenStorage } from "../native/bridge";
import { NativePhoneSection } from "../components/native/NativePhoneSection";

describe("Native Capacitor Bridge & Screens (Stage 1)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete window.__SMF_NATIVE_SHIM__;
  });

  it("detects native shim mode and keeps refresh tokens out of web storage", async () => {
    const store = new Map<string, string>();
    window.__SMF_NATIVE_SHIM__ = {
      secureStorage: {
        get: async (k) => store.get(k) ?? null,
        set: async (k, v) => {
          store.set(k, v);
        },
        remove: async (k) => {
          store.delete(k);
        },
      },
      appVersionCode: 10,
      appVersionName: "1.10.0",
    };

    expect(isNativeApp()).toBe(true);
    await nativeTokenStorage.setRefreshToken("secret-native-refresh-jwt");

    expect(await nativeTokenStorage.getRefreshToken()).toBe("secret-native-refresh-jwt");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);

    await nativeTokenStorage.clearRefreshToken();
    expect(await nativeTokenStorage.getRefreshToken()).toBeNull();
  });

  it("renders This phone section in native mode only", () => {
    const { unmount } = render(
      <MemoryRouter>
        <NativePhoneSection />
      </MemoryRouter>
    );
    expect(screen.queryByTestId("native-this-phone-section")).toBeNull();
    unmount();

    window.__SMF_NATIVE_SHIM__ = {
      appVersionCode: 2,
      appVersionName: "1.10.0",
    };
    render(
      <MemoryRouter>
        <NativePhoneSection />
      </MemoryRouter>
    );
    expect(screen.getByTestId("native-this-phone-section")).toBeInTheDocument();
    expect(screen.getByTestId("native-test-push-btn")).toBeDisabled();
  });

  it("returns /api/v1 on standard web build", () => {
    expect(isNativeApp()).toBe(false);
    expect(getApiBaseUrl()).toBe("/api/v1");
    vi.restoreAllMocks();
  });
});
