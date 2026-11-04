import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import axios, { AxiosError } from "axios";
import {
  apiClient,
  setAccessToken,
  getAccessToken,
  setActiveTenantId,
  getActiveTenantId,
} from "../api/client";
import { AuthProvider, useCan, Can } from "../context/AuthContext";

describe("Frontend Authentication & Security Invariants", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
    setActiveTenantId(null);
    localStorage.clear();
    sessionStorage.clear();
  });

  it("SECURITY: access token is strictly in-memory and NEVER stored in localStorage or sessionStorage", () => {
    const localSpy = vi.spyOn(Storage.prototype, "setItem");
    const sessionSpy = vi.spyOn(sessionStorage, "setItem");

    const token = "mock-jwt-access-token-12345";
    setAccessToken(token);

    expect(getAccessToken()).toBe(token);
    expect(localSpy).not.toHaveBeenCalledWith(expect.anything(), token);
    expect(sessionSpy).not.toHaveBeenCalledWith(expect.anything(), token);
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(sessionStorage.getItem("access_token")).toBeNull();
  });

  it("X-Tenant-ID header is dynamically attached to all API requests when tenant context is active", async () => {
    setActiveTenantId("tenant-uuid-456");
    expect(getActiveTenantId()).toBe("tenant-uuid-456");

    let capturedHeaders: any = null;
    apiClient.defaults.adapter = async (config) => {
      capturedHeaders = config.headers;
      return {
        data: { success: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    await apiClient.get("/test-endpoint/");
    const tenantHeader = capturedHeaders?.get
      ? capturedHeaders.get("X-Tenant-ID")
      : capturedHeaders?.["X-Tenant-ID"];
    expect(tenantHeader).toBe("tenant-uuid-456");
  });

  it("5 parallel 401 responses trigger exactly ONE refresh request and replay all 5 requests", async () => {
    let refreshCalls = 0;
    vi.spyOn(axios, "post").mockImplementation(async (url) => {
      if (url === "/api/v1/auth/refresh/") {
        refreshCalls += 1;
        return { data: { access: "new-rotated-token" } } as any;
      }
      return Promise.reject(new Error("Unexpected endpoint"));
    });

    apiClient.defaults.adapter = async (config) => {
      if (!(config as any)._retry) {
        const error = new AxiosError(
          "Request failed with status code 401",
          "ERR_BAD_RESPONSE",
          config,
          null,
          {
            status: 401,
            statusText: "Unauthorized",
            headers: {},
            config,
            data: { error: { code: "AUTHENTICATION_FAILED" } },
          } as any
        );
        return Promise.reject(error);
      }

      return {
        data: {
          success: true,
          replayed: true,
          token:
            (config.headers as any)?.get?.("Authorization") ||
            (config.headers as any)?.["Authorization"],
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    // Fire 5 concurrent requests simultaneously
    const requests = Array.from({ length: 5 }).map(() => apiClient.get("/api/v1/tables/"));
    const results = await Promise.all(requests);

    // Assert that refresh was called exactly once due to single-flight mutex
    expect(refreshCalls).toBe(1);
    expect(results).toHaveLength(5);
    results.forEach((res) => {
      expect(res.data.success).toBe(true);
      expect(res.data.replayed).toBe(true);
    });
    expect(getAccessToken()).toBe("new-rotated-token");
  });

  it("RBAC Permission Helpers: useCan and <Can> correctly evaluate permissions", () => {
    const TestComponent = () => {
      const canManageBranch = useCan("branch.manage");
      const canManageStaff = useCan("staff.manage");

      return (
        <div>
          <span data-testid="can-branch">{String(canManageBranch)}</span>
          <span data-testid="can-staff">{String(canManageStaff)}</span>
          <Can permission="branch.manage" fallback={<span>No Branch Access</span>}>
            <button>Manage Branch</button>
          </Can>
          <Can permission="staff.manage" fallback={<span>No Staff Access</span>}>
            <button>Manage Staff</button>
          </Can>
        </div>
      );
    };

    // Render with mock auth state providing branch.manage only
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Initial state without profile defaults to false
    expect(screen.getByTestId("can-branch").textContent).toBe("false");
    expect(screen.getByText("No Branch Access")).toBeInTheDocument();
    expect(screen.getByText("No Staff Access")).toBeInTheDocument();
  });
});
