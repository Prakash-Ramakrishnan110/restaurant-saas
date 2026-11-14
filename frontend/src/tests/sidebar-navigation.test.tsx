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

  it("renders 4 grouped navigation sections with unified Venue Layout and Inventory for Cafe Owner", async () => {
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

    // Daily work items including Inventory
    expect(screen.getAllByText("Menu").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Today's Availability")).toBeDefined();
    expect(screen.getByText("Inventory & Stock")).toBeDefined();

    // Unified Venue Layout hub replaces separate Areas, Tables, Floor Plan
    expect(screen.getByText("Venue Layout")).toBeDefined();
    expect(screen.getByText("QR Codes")).toBeDefined();
    expect(screen.getAllByText("Staff").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Branding")).toBeDefined();

    // Cluttered separate items should not exist in the sidebar
    expect(screen.queryByText("Service Areas")).toBeNull();
    expect(screen.queryByText("Dining Tables")).toBeNull();
    expect(screen.queryByText("Counters and Tokens")).toBeNull();
  });

  it("renders unified Venue Layout and hides separate tables/counters in sidebar for Tea Shop Owner", async () => {
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
      // Setup has unified Venue Layout
      expect(screen.getByText("Venue Layout")).toBeDefined();
    });

    // Daily work has Inventory & Stock
    expect(screen.getByText("Inventory & Stock")).toBeDefined();

    // Separate clutter should not exist in sidebar
    expect(screen.queryByText("Counters and Tokens")).toBeNull();
    expect(screen.queryByText("Dining Tables")).toBeNull();
    expect(screen.queryByText("Hotel Rooms")).toBeNull();
  });

  it("renders unified Venue Layout and Inventory for Hotel Owner", async () => {
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

    expect(screen.getByText("Venue Layout")).toBeDefined();
    expect(screen.getByText("Inventory & Stock")).toBeDefined();
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

    // Waiter in v0.8.0 sees Floor Service items: Tables and Orders, Live Orders, Ready to Serve, Menu
    expect(screen.getAllByText("Tables and Orders").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Live Orders").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ready to Serve").length).toBeGreaterThanOrEqual(1);

    // Waiter does NOT see management links or dashboard
    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.queryByText("Onboarding")).toBeNull();
    expect(screen.queryByText("Branches")).toBeNull();
    expect(screen.queryByText("Venue Layout")).toBeNull();
    expect(screen.queryByText("Staff")).toBeNull();
    expect(screen.queryByText("Branding")).toBeNull();
  });
});
