import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ShiftCloseoutPage } from "../pages/billing/ShiftCloseoutPage";
import { InvoicesHistoryPage } from "../pages/billing/InvoicesHistoryPage";
import { computeEqualSplitShares } from "../utils/thermalPrint";
import { apiClient } from "../api/client";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "u-1",
      email: "owner@spice.test",
      full_name: "Owner User",
      is_platform_admin: false,
    },
    activeTenant: {
      tenant_id: "t-1",
      tenant_name: "Spice Garden",
      tenant_slug: "spice-garden",
      role: "OWNER",
      is_active: true,
    },
    activeRole: "OWNER",
    can: () => true,
  }),
}));

describe("Stage B Operational Hardening Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("computes equal N-way split shares in integer paise with remainder on Share 1", () => {
    const shares = computeEqualSplitShares(10000, 3);
    expect(shares.map((s) => s.amount_paise)).toEqual([3334, 3333, 3333]);
    expect(shares.reduce((acc, s) => acc + s.amount_paise, 0)).toBe(10000);
  });

  it("renders ShiftCloseoutPage with blind count, denomination helper, and mid-shift movements", async () => {
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes("/invoices/")) {
        return {
          data: [
            {
              id: "inv-1",
              invoice_number: "INV-202611-0001",
              subtotal_paise: 54600,
              total_paise: 54600,
              payment_method: "CASH",
            },
          ],
        } as unknown as Awaited<ReturnType<typeof apiClient.get>>;
      }
      return { data: {} } as unknown as Awaited<ReturnType<typeof apiClient.get>>;
    });

    render(
      <MemoryRouter>
        <ShiftCloseoutPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Cashier Shift Closeout \(Z-Report\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Blind Count Active/i)).toBeInTheDocument();

    // Open denomination counter
    fireEvent.click(screen.getByRole("button", { name: /Count Notes & Coins/i }));
    expect(screen.getByText(/Denomination Note & Coin Counter/i)).toBeInTheDocument();

    // Enter counted cash and reconcile
    fireEvent.change(screen.getByPlaceholderText("Enter counted cash..."), {
      target: { value: "2546" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Reconcile & Generate Z-Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Expected Drawer Cash:/i)).toBeInTheDocument();
      expect(screen.getByText(/SHIFT LOCKED/i)).toBeInTheDocument();
    });
  });

  it("renders InvoicesHistoryPage with append-only partial refund modal and compulsory reason codes", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: [
        {
          id: "inv-100",
          invoice_number: "INV-202611-0100",
          subtotal_paise: 45000,
          total_paise: 45000,
          refunded_paise: 0,
          net_total_paise: 45000,
          payment_method: "CASH",
          created_at: new Date().toISOString(),
          snapshot_lines: [
            {
              item_name: "Masala Dosa",
              quantity: 2,
              unit_price_paise: 22500,
              subtotal_paise: 45000,
            },
          ],
        },
      ],
    } as unknown as Awaited<ReturnType<typeof apiClient.get>>);

    render(
      <MemoryRouter>
        <InvoicesHistoryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("INV-202611-0100")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Refund/i }));
    expect(screen.getByText(/Partial Refund \/ Bill Adjustment/i)).toBeInTheDocument();
    expect(screen.getByText(/Compulsory Reason Code/i)).toBeInTheDocument();
  });
});
