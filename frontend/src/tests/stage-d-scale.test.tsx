import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OutletComparisonPage } from "../pages/reports/OutletComparisonPage";
import { SuppliersPurchasesPage } from "../pages/inventory/SuppliersPurchasesPage";
import { CustomersPage } from "../pages/customers/CustomersPage";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { defaultResources } from "../i18n";
import { apiClient } from "../api/client";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            {ui}
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

describe("Stage D: Scale & Polish (Multi-Outlet, Purchase Orders, Guest Loyalty & A11y)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes("/reports/outlets/")) {
        return {
          data: {
            start_date: "2026-11-15",
            end_date: "2026-11-21",
            totals: {
              orders_count: 14,
              invoices_count: 12,
              gross_sales_paise: 540000,
              refunds_paise: 20000,
              net_sales_paise: 520000,
              cogs_paise: 150000,
              gross_margin_paise: 370000,
              gross_margin_percent: 71.2,
              wastage_paise: 12000,
            },
            outlets: [
              {
                branch_id: "b-1",
                name: "Indiranagar Flagship",
                venue_profile: "CASUAL_DINING",
                invoices_count: 12,
                total_sales_paise: 540000,
                gross_sales_paise: 540000,
                refunds_paise: 20000,
                net_sales_paise: 520000,
                cogs_paise: 150000,
                gross_margin_paise: 370000,
                gross_margin_percent: 71.2,
                wastage_paise: 12000,
                average_ticket_paise: 45000,
              },
            ],
          },
        } as any;
      }
      if (url.includes("/customers/")) {
        return {
          data: [
            {
              id: "c-1",
              name: "Priya Raman",
              phone: "+919900112233",
              email: "priya@example.com",
              consent_given: true,
              dietary_preference: "VEG",
              allergies: "Peanuts",
              notes: "VIP window table",
              visit_count: 6,
              total_spend_paise: 185000,
              loyalty_points: 45,
              last_visit_at: "2026-11-21T08:00:00Z",
            },
          ],
        } as any;
      }
      return { data: [] } as any;
    });
  });

  it("renders Multi-Outlet Consolidated Totals & Inter-Branch Transfers with 0 serious/critical axe violations", async () => {
    const { container } = renderWithProviders(<OutletComparisonPage />);
    expect(await screen.findByText("Multi-Outlet Revenue Comparison")).toBeInTheDocument();
    expect(await screen.findByText("Group Net Sales")).toBeInTheDocument();
    expect(await screen.findByText("Inter-Branch Stock Transfers")).toBeInTheDocument();

    const results = await axe(container);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toHaveLength(0);
  });

  it("renders Suppliers & Purchase Orders page with 0 serious/critical axe violations", async () => {
    const { container } = renderWithProviders(<SuppliersPurchasesPage />);
    expect(
      await screen.findByText(/Purchase Orders & One-Click Goods Receipt/i)
    ).toBeInTheDocument();

    const results = await axe(container);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toHaveLength(0);
  });

  it("renders Guest Profiles & VIP Loyalty points with 0 serious/critical axe violations", async () => {
    const { container } = renderWithProviders(<CustomersPage />);
    expect(await screen.findByText("Priya Raman")).toBeInTheDocument();
    expect(await screen.findByText("45 pts")).toBeInTheDocument();

    const results = await axe(container);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toHaveLength(0);
  });

  it("maintains 100% EN/TA translation parity for Stage D scale keys", () => {
    const enScaleKeys = Object.keys(defaultResources.en.translation.scale).sort();
    const taScaleKeys = Object.keys(defaultResources.ta.translation.scale).sort();
    expect(enScaleKeys).toEqual(taScaleKeys);
    expect(enScaleKeys.length).toBeGreaterThanOrEqual(7);
  });
});
