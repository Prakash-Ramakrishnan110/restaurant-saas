import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mapBackendErrorCode } from "../lib/errorMapper";
import { BranchesPage } from "../pages/venue/BranchesPage";
import { CountersPage } from "../pages/venue/CountersPage";
import { FloorPlanPage } from "../pages/venue/FloorPlanPage";
import { StaffPage } from "../pages/staff/StaffPage";
import { VenueSettingsPage } from "../pages/settings/VenueSettingsPage";
import * as AuthContextModule from "../context/AuthContext";
import { apiClient } from "../api/client";

vi.mock("../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(),
  setActiveTenantId: vi.fn(),
}));

describe("Prompt 3C: Error Code Mapper & Business Logic Unit Tests", () => {
  it("maps all Prompt 3C backend error codes to plain user-friendly messages", () => {
    const codes = [
      "DUPLICATE_LABEL",
      "ENTITLEMENT_LIMIT_REACHED",
      "TABLE_NOT_AVAILABLE",
      "INVALID_STATUS_TRANSITION",
      "TABLES_NOT_COMBINABLE",
      "SESSION_ALREADY_OPEN",
      "LAST_OWNER",
      "ROLE_NOT_ALLOWED",
      "INVALID_CAPABILITY_COMBINATION",
    ];

    codes.forEach((code) => {
      const msg = mapBackendErrorCode({ error: { code } });
      expect(msg).not.toBe("An unexpected error occurred. Please try again.");
      expect(msg.length).toBeGreaterThan(10);
    });
  });

  it("handles fallback to detail or message when code is not found", () => {
    const fallbackMsg = mapBackendErrorCode({
      response: { data: { detail: "Custom server error detail" } },
    });
    expect(fallbackMsg).toBe("Custom server error detail");
  });
});

describe("Prompt 3C: Management Screens Role Visibility & Accessibility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const setupAuthMock = (role: string, permissions: string[]) => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: {
        id: "u-1",
        email: "user@example.com",
        full_name: "Test User",
        is_platform_admin: false,
      },
      memberships: [
        {
          tenant_id: "t-1",
          tenant_name: "Test Venue",
          tenant_slug: "test-venue",
          role,
          is_active: true,
          permissions,
        },
      ],
      activeTenant: {
        tenant_id: "t-1",
        tenant_name: "Test Venue",
        tenant_slug: "test-venue",
        role,
        is_active: true,
        permissions,
      },
      activeRole: role,
      permissions,
      mustChangePassword: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      selectTenant: vi.fn(),
      can: (perm: string) => permissions.includes(perm),
    });
  };

  it("BranchesPage: Owner sees Add Branch button; Manager does not", async () => {
    // Owner
    setupAuthMock("OWNER", ["branch.view", "branch.manage"]);
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ id: "b-1", name: "Central Branch", venue_profile: "CAFE", is_active: true }],
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { entitlements: { max_branches: 3 } },
    });

    const { unmount } = render(
      <MemoryRouter>
        <BranchesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Add New Branch")).toBeDefined();
    });
    unmount();

    // Manager
    setupAuthMock("BRANCH_MANAGER", ["branch.view"]);
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ id: "b-1", name: "Central Branch", venue_profile: "CAFE", is_active: true }],
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { entitlements: { max_branches: 3 } },
    });

    render(
      <MemoryRouter>
        <BranchesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText("Add New Branch")).toBeNull();
    });
  });

  it("CountersPage: ZERO occurrence of the word 'table' in DOM or text", async () => {
    setupAuthMock("OWNER", ["area.view", "area.manage"]);
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ id: "b-1", name: "Chai Express", venue_profile: "QUICK_SERVICE" }],
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ id: "c-1", name: "Tea Counter", area_type: "TAKEOUT", is_active: true }],
    });

    const { container } = render(
      <MemoryRouter>
        <CountersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Counters and Tokens").length).toBeGreaterThanOrEqual(1);
    });

    const pageText = container.textContent || "";
    expect(pageText.toLowerCase()).not.toContain("table");
    expect(pageText).not.toContain("மேஜை");
  });

  it("StaffPage: Displays temporary password ONCE upon creation and clears on dismiss", async () => {
    setupAuthMock("OWNER", ["staff.view", "staff.manage"]);
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] }); // staff
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [{ id: "b-1", name: "Main Branch" }] }); // branches
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        id: "mem-2",
        role: "WAITER",
        is_active: true,
        user: { id: "u-2", email: "waiter@test.com", full_name: "Waiter User" },
        branches: [{ id: "b-1", name: "Main Branch" }],
        temporary_password: "TempPass9988!@#",
      },
    });

    render(
      <MemoryRouter>
        <StaffPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Add Team Member")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Add Team Member"));

    fireEvent.change(screen.getByPlaceholderText("e.g. Anand Kumar"), {
      target: { value: "Waiter User" },
    });
    fireEvent.change(screen.getByPlaceholderText("anand@example.com"), {
      target: { value: "waiter@test.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Temporary Password Generated")).toBeDefined();
      expect(screen.getByText("TempPass9988!@#")).toBeDefined();
      expect(screen.getByText(/They must change it at first sign-in/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText("I have saved the password"));

    await waitFor(() => {
      expect(screen.queryByText("TempPass9988!@#")).toBeNull();
    });
  });

  it("VenueSettingsPage: Displays grouped switches and reset button", async () => {
    setupAuthMock("OWNER", ["business.view", "business.manage"]);
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ id: "b-1", name: "Main Branch", venue_profile: "CAFE" }],
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { entitlements: { courses: true } },
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        uses_tables: true,
        uses_token_numbers: false,
        uses_kds: false,
        supports_courses: false,
        allows_takeaway: true,
        allows_room_service: false,
        allows_room_charge: false,
        has_sections: false,
        has_seat_ordering: false,
        allows_table_transfer: true,
        allows_qr_ordering: true,
        payment_timing: "EITHER",
        qr_ordering_mode: "ORDER_DIRECT",
        qr_session_policy: "CUSTOMER_CAN_OPEN",
        order_workflow: "TABLE_SERVICE",
      },
    });

    render(
      <MemoryRouter>
        <VenueSettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Dining & Floor Layout")).toBeDefined();
      expect(screen.getByText("Reset to Venue Defaults")).toBeDefined();
    });
  });

  it("FloorPlanPage: Displays header notice that drag-and-drop comes later", async () => {
    setupAuthMock("OWNER", ["table.view", "floor.manage"]);
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ id: "sec-1", name: "AC Dining", color: "#3B82F6" }],
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [
        {
          id: "t-1",
          label: "T1",
          capacity: 4,
          shape: "SQUARE",
          status: "AVAILABLE",
          is_active: true,
          section: { id: "sec-1", name: "AC Dining" },
        },
      ],
    });

    render(
      <MemoryRouter>
        <FloorPlanPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Drag-and-drop editing comes later/i)).toBeDefined();
      expect(screen.getByText("T1")).toBeDefined();
    });
  });
});
