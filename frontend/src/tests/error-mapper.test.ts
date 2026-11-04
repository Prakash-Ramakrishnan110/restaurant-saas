import { describe, it, expect } from "vitest";
import { normalizeApiError } from "../api/client";

describe("Backend Error Code Normalization & Mapping", () => {
  it("normalizes structured backend error responses", () => {
    const rawError: any = {
      response: {
        status: 400,
        data: {
          error: {
            code: "INVALID_STATUS_TRANSITION",
            message: "Cannot transition table from OCCUPIED to AVAILABLE directly.",
            details: { from: "OCCUPIED", to: "AVAILABLE", allowed: ["CLEANING"] },
          },
        },
      },
    };

    const normalized = normalizeApiError(rawError);
    expect(normalized.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(normalized.error.details.from).toBe("OCCUPIED");
    expect(normalized.error.details.allowed).toEqual(["CLEANING"]);
  });

  it("handles ENTITLEMENT_LIMIT_REACHED with limit metrics", () => {
    const rawError: any = {
      response: {
        status: 403,
        data: {
          error: {
            code: "ENTITLEMENT_LIMIT_REACHED",
            message: "Maximum table count of 15 reached for Starter tier.",
            details: { limit_key: "max_tables", limit: 15, current: 15 },
          },
        },
      },
    };

    const normalized = normalizeApiError(rawError);
    expect(normalized.error.code).toBe("ENTITLEMENT_LIMIT_REACHED");
    expect(normalized.error.details.limit_key).toBe("max_tables");
    expect(normalized.error.details.limit).toBe(15);
  });

  it("handles PASSWORD_CHANGE_REQUIRED code", () => {
    const rawError: any = {
      response: {
        status: 403,
        data: {
          error: {
            code: "PASSWORD_CHANGE_REQUIRED",
            message: "You must change your temporary password before accessing this resource.",
            details: {},
          },
        },
      },
    };

    const normalized = normalizeApiError(rawError);
    expect(normalized.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("handles TENANT_SUSPENDED code", () => {
    const rawError: any = {
      response: {
        status: 403,
        data: {
          error: {
            code: "TENANT_SUSPENDED",
            message: "Tenant is suspended.",
            details: {},
          },
        },
      },
    };

    const normalized = normalizeApiError(rawError);
    expect(normalized.error.code).toBe("TENANT_SUSPENDED");
  });

  it("handles RATE_LIMITED code with wait seconds", () => {
    const rawError: any = {
      response: {
        status: 429,
        data: {
          error: {
            code: "RATE_LIMITED",
            message: "Request was throttled. Expected available in 45 seconds.",
            details: { wait_seconds: 45 },
          },
        },
      },
    };

    const normalized = normalizeApiError(rawError);
    expect(normalized.error.code).toBe("RATE_LIMITED");
    expect(normalized.error.details.wait_seconds).toBe(45);
  });

  it("falls back gracefully when error response is unformatted or network drops", () => {
    const networkError: any = {
      message: "Network Error",
      code: "ERR_NETWORK",
    };

    const normalized = normalizeApiError(networkError);
    expect(normalized.error.code).toBe("ERR_NETWORK");
    expect(normalized.error.message).toBe("Network Error");
  });
});
