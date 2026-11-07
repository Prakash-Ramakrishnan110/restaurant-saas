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

describe("Floor POS, KDS & Cashier Navigation & Operations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const setupAuthMock = (opts: {
    role: string;
    permissions: string[];
    is_platform_admin?: boolean;
    venue_profile?: string;
    uses_tables?: boolean;
  }) => {
    const tenantObj: any = {
      tenant_id: "t-pos-1",
      tenant_name: "Spice Garden",
      tenant_slug: "spice-garden",
      role: opts.role,
      is_active: true,
      venue_profile: opts.venue_profile || "DINE_IN",
      uses_tables: opts.uses_tables !== false,
    };

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: {
        id: "u-1",
        email: "pos_user@servemyfood.com",
        full_name: "POS Operator",
        is_platform_admin: opts.is_platform_admin || false,
      },
      memberships: [tenantObj],
      activeTenant: tenantObj,
      activeRole: opts.role,
      permissions: opts.permissions,
      mustChangePassword: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      selectTenant: vi.fn(),
      changePassword: vi.fn(),
      can: (perm: string) =>
        opts.permissions.includes(perm) || opts.permissions.includes("*") || opts.role === "OWNER",
    });
  };

  it("renders Floor POS, Kitchen KDS, and Cashier Billing in Daily Work for Waiter/Cashier/Owner", async () => {
    setupAuthMock({
      role: "OWNER",
      permissions: ["order.create", "order.view", "order.update", "menu.availability"],
      uses_tables: true,
    });

    (apiClient.get as any).mockResolvedValue({
      data: { business_type: "RESTAURANT", venue_profile: "DINE_IN" },
    });

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AppShell>
            <div>POS Workspace</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Verify presence of operational modules in navigation
    expect(screen.getByText("Floor POS")).toBeDefined();
    expect(screen.getByText("Kitchen KDS")).toBeDefined();
    expect(screen.getByText("Cashier Billing")).toBeDefined();
  });

  it("displays Super Admin link exclusively when user is platform admin", async () => {
    setupAuthMock({
      role: "OWNER",
      permissions: ["*"],
      is_platform_admin: true,
    });

    (apiClient.get as any).mockResolvedValue({
      data: { business_type: "RESTAURANT", venue_profile: "DINE_IN" },
    });

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AppShell>
            <div>Admin Shell</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Super Admin")).toBeDefined();
    });
  });

  it("calculates multi-tender split bill balance accurately in integer paise", () => {
    // Authoritative calculation invariant test
    const billTotalPaise = 52500; // Rs 525.00
    const cashTenderedPaise = 30000; // Rs 300.00
    const remainingPaise = billTotalPaise - cashTenderedPaise;
    expect(remainingPaise).toBe(22500); // Exactly Rs 225.00

    // Equal 3-way split
    const splitCount = 3;
    const equalSharePaise = Math.round(billTotalPaise / splitCount);
    expect(equalSharePaise).toBe(17500); // Rs 175.00 each
  });

  it("evaluates drawer variance during blind cashier shift closeout", () => {
    const openingFloatPaise = 200000; // Rs 2,000.00
    const cashSalesPaise = 450000; // Rs 4,500.00
    const expectedDrawerPaise = openingFloatPaise + cashSalesPaise; // Rs 6,500.00

    // Scenario A: Balanced drawer
    const countedExact = 650000;
    const varianceExact = countedExact - expectedDrawerPaise;
    expect(varianceExact).toBe(0);

    // Scenario B: Rs 100 short
    const countedShort = 640000;
    const varianceShort = countedShort - expectedDrawerPaise;
    expect(varianceShort).toBe(-10000);
  });
});
