import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ThemeProvider } from "../context/ThemeContext";
import * as AuthContextModule from "../context/AuthContext";
import { apiClient } from "../api/client";

vi.mock("../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(),
  setActiveTenantId: vi.fn(),
}));

describe("AppShell Sidebar Navigation Structure & Role Filtering", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const setupAuthMock = (role: string, permissions: string[], tenantInfo: any) => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: {
        id: "u-1",
        email: "user@example.com",
        full_name: "Test User",
        is_platform_admin: false,
      },
      memberships: [
        {
          tenant_id: tenantInfo.tenant_id || "t-1",
          tenant_name: tenantInfo.tenant_name || "Test Venue",
          tenant_slug: "test-venue",
          role,
          is_active: true,
          ...tenantInfo,
        },
      ],
      activeTenant: {
        tenant_id: tenantInfo.tenant_id || "t-1",
        tenant_name: tenantInfo.tenant_name || "Test Venue",
        tenant_slug: "test-venue",
        role,
        is_active: true,
        ...tenantInfo,
      },
      activeRole: role,
      permissions,
      mustChangePassword: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      selectTenant: vi.fn(),
      changePassword: vi.fn(),
      can: (perm: string) =>
        permissions.includes(perm) || permissions.includes("*") || role === "OWNER",
    });
  };

  it("renders 4 grouped navigation sections with correct labels for Cafe Owner", async () => {
    setupAuthMock("OWNER", ["*"], {
      business_type: "CAFE",
      venue_profile: "CAFE",
      uses_tables: true,
      tenant_name: "Cozy Bean Cafe",
    });

    (apiClient.get as any).mockResolvedValue({
      data: { business_type: "CAFE", venue_profile: "CAFE" },
    });

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AppShell>
            <div>Main Content</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Group labels
    expect(screen.getByText("Daily work")).toBeDefined();
    expect(screen.getByText("Restaurant setup")).toBeDefined();
    expect(screen.getByText("Team")).toBeDefined();
    expect(screen.getAllByText("Settings").length).toBeGreaterThanOrEqual(1);

    // Renamed items
    expect(screen.getByText("Menu")).toBeDefined();
    expect(screen.getByText("Today's Availability")).toBeDefined();
    expect(screen.getByText("Areas")).toBeDefined();
    expect(screen.getAllByText("Tables").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Floor Plan")).toBeDefined();
    expect(screen.getByText("QR Codes")).toBeDefined();
    expect(screen.getAllByText("Staff").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Branding")).toBeDefined();

    // Old names should not exist
    expect(screen.queryByText("Service Areas")).toBeNull();
    expect(screen.queryByText("Dining Tables")).toBeNull();
    // Counters should not show for cafe
    expect(screen.queryByText("Counters and Tokens")).toBeNull();
  });

  it("hides Tables and Floor Plan, and shows Counters and Tokens for Tea Shop Owner", async () => {
    setupAuthMock("OWNER", ["*"], {
      business_type: "TEA_SHOP",
      venue_profile: "QUICK_SERVICE",
      uses_tables: false,
      tenant_name: "Chai Express",
    });

    (apiClient.get as any).mockResolvedValue({
      data: { business_type: "TEA_SHOP", venue_profile: "QUICK_SERVICE" },
    });

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AppShell>
            <div>Main Content</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    await waitFor(() => {
      // Must show Counters and Tokens
      expect(screen.getByText("Counters and Tokens")).toBeDefined();
    });

    // Areas is still shown
    expect(screen.getByText("Areas")).toBeDefined();

    // Tables and Floor Plan MUST be hidden
    expect(screen.queryByText("Tables")).toBeNull();
    expect(screen.queryByText("Floor Plan")).toBeNull();
    expect(screen.queryByText("Dining Tables")).toBeNull();
  });

  it("renders full layout and tables for Hotel Owner", async () => {
    setupAuthMock("OWNER", ["*"], {
      business_type: "HOTEL",
      venue_profile: "HOTEL_RESTAURANT",
      uses_tables: true,
      tenant_name: "Grand Palace Hotel",
    });

    (apiClient.get as any).mockResolvedValue({
      data: { business_type: "HOTEL", venue_profile: "HOTEL_RESTAURANT" },
    });

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AppShell>
            <div>Main Content</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(screen.getByText("Areas")).toBeDefined();
    expect(screen.getAllByText("Tables").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Floor Plan")).toBeDefined();
    expect(screen.queryByText("Counters and Tokens")).toBeNull();
  });

  it("enforces role-based filtering: Waiter only sees permitted screens and no management groups", async () => {
    setupAuthMock("WAITER", ["table.view"], {
      business_type: "CAFE",
      venue_profile: "CAFE",
      uses_tables: true,
      tenant_name: "Bistro 9",
    });

    (apiClient.get as any).mockResolvedValue({
      data: { business_type: "CAFE", venue_profile: "CAFE" },
    });

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AppShell>
            <div>Main Content</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Waiter has table.view -> sees Tables
    expect(screen.getAllByText("Tables").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);

    // Waiter does NOT see management links
    expect(screen.queryByText("Onboarding")).toBeNull();
    expect(screen.queryByText("Branches")).toBeNull();
    expect(screen.queryByText("Staff")).toBeNull();
    expect(screen.queryByText("Branding")).toBeNull();
    expect(screen.queryByText("Floor Plan")).toBeNull();
  });
});
