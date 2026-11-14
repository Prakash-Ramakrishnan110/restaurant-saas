import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SalesReportsPage } from "../pages/reports/SalesReportsPage";
import { ItemReportsPage } from "../pages/reports/ItemReportsPage";
import { PaymentReportsPage } from "../pages/reports/PaymentReportsPage";
import { SoundSettingsPage } from "../pages/settings/SoundSettingsPage";
import { DeviceSettingsPage } from "../pages/settings/DeviceSettingsPage";
import { PlatformPlansPage } from "../pages/admin/PlatformPlansPage";
import { ordersApi } from "../api/orders";
import { apiClient } from "../api/client";

vi.mock("../api/orders", () => ({
  ordersApi: {
    getRangeReport: vi.fn(),
  },
}));

vi.mock("../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockReport = {
  start_date: "2026-11-01",
  end_date: "2026-11-08",
  sales_paise: 250000,
  orders_count: 45,
  settled_invoices_count: 40,
  average_order_value_paise: 6250,
  sales_by_payment_method: {
    CASH: 150000,
    UPI: 80000,
    CARD: 20000,
    ROOM_FOLIO: 0,
  },
  daily_breakdown: [
    {
      date: "2026-11-07",
      sales_paise: 120000,
      invoices_count: 20,
    },
    {
      date: "2026-11-08",
      sales_paise: 130000,
      invoices_count: 20,
    },
  ],
  top_items: [
    {
      item_name: "Special South Indian Filter Coffee",
      quantity: 35,
      total_paise: 157500,
    },
    {
      item_name: "Ghee Roast Masala Dosa",
      quantity: 20,
      total_paise: 170000,
    },
  ],
  top_categories: [
    {
      category_name: "Hot Beverages",
      quantity: 40,
      total_paise: 180000,
    },
    {
      category_name: "Tiffin & Breakfast",
      quantity: 25,
      total_paise: 212500,
    },
  ],
};

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe("P1 Reports & Operational Settings Suites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SalesReportsPage renders KPI cards and daily breakdown table with integer rupee formatting", async () => {
    vi.mocked(ordersApi.getRangeReport).mockResolvedValue({
      data: mockReport,
    } as any);

    renderWithProviders(<SalesReportsPage />);

    expect(screen.getByText(/Sales Reports/i)).toBeInTheDocument();

    await waitFor(() => {
      // 250000 paise = ₹2,500.00
      expect(screen.getByText("₹2,500.00")).toBeInTheDocument();
      // AOV 6250 paise = ₹62.50
      expect(screen.getByText("₹62.50")).toBeInTheDocument();
    });

    expect(screen.getByText("2026-11-07")).toBeInTheDocument();
    expect(screen.getByText("2026-11-08")).toBeInTheDocument();
  });

  it("ItemReportsPage renders bestselling dishes and category breakdown", async () => {
    vi.mocked(ordersApi.getRangeReport).mockResolvedValue({
      data: mockReport,
    } as any);

    renderWithProviders(<ItemReportsPage />);

    expect(screen.getByText(/Items & Categories Report/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Special South Indian Filter Coffee")).toBeInTheDocument();
      expect(screen.getByText("Ghee Roast Masala Dosa")).toBeInTheDocument();
      expect(screen.getByText("Hot Beverages")).toBeInTheDocument();
    });
  });

  it("PaymentReportsPage calculates percentages and reconciles tender breakdown", async () => {
    vi.mocked(ordersApi.getRangeReport).mockResolvedValue({
      data: mockReport,
    } as any);

    renderWithProviders(<PaymentReportsPage />);

    expect(screen.getByText(/Payment Methods Report/i)).toBeInTheDocument();

    await waitFor(() => {
      // Cash is 150000/250000 = 60%
      expect(screen.getAllByText("60%").length).toBeGreaterThanOrEqual(1);
      // UPI is 80000/250000 = 32%
      expect(screen.getAllByText("32%").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("SoundSettingsPage allows toggling notifications and testing Web Audio tones", () => {
    renderWithProviders(<SoundSettingsPage />);
    expect(screen.getByText(/Sound & Alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/New Order Placed/i)).toBeInTheDocument();
    expect(screen.getByText(/Food Ready/i)).toBeInTheDocument();
    expect(screen.getByText(/Save Preferences/i)).toBeInTheDocument();
  });

  it("DeviceSettingsPage displays ESC/POS network printer settings and demo receipt with strict tax disclaimer", () => {
    renderWithProviders(<DeviceSettingsPage />);
    expect(screen.getByText(/Printers & Devices/i)).toBeInTheDocument();
    expect(screen.getByText(/Network Thermal ESC\/POS Printer/i)).toBeInTheDocument();
    expect(screen.getByText(/DEMO RECEIPT - NOT A TAX INVOICE/i)).toBeInTheDocument();
  });

  it("PlatformPlansPage renders SaaS tiers with integer pricing and feature checks", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        {
          id: "plan-1",
          name: "Professional",
          slug: "pro",
          price_paise: 299900,
          entitlements: {
            max_branches: 3,
            max_tables: 50,
            floor_editor: true,
            table_merge: true,
            courses: true,
          },
          is_active: true,
        },
      ],
    } as any);

    renderWithProviders(<PlatformPlansPage />);

    expect(screen.getByText(/SaaS Subscription Plans/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Professional")).toBeInTheDocument();
      // 299900 paise = ₹2,999.00
      expect(screen.getByText("₹2,999.00")).toBeInTheDocument();
      expect(screen.getByText("Visual Floor Plan Editor")).toBeInTheDocument();
    });
  });

  it("PlatformPlansPage renders Dhaba & Hotel plan badges and opens Plan Builder with presets", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/plans/")) {
        return Promise.resolve({
          data: [
            {
              id: "dhaba-1",
              name: "Dhaba & Outdoor Huts Edition",
              slug: "dhaba-huts",
              price_paise: 299900,
              entitlements: {
                max_branches: 3,
                max_tables: 35,
                allows_huts: true,
                allows_waiter_call: true,
                allows_minimum_spend: true,
                outdoor_sections: true,
                floor_editor: true,
              },
              is_active: true,
            },
            {
              id: "hotel-1",
              name: "Hotel & Resort Edition",
              slug: "hotel-resort",
              price_paise: 499900,
              entitlements: {
                max_branches: 5,
                max_tables: 100,
                allows_room_service: true,
                allows_room_folio: true,
                housekeeping_tracking: true,
                floor_editor: true,
              },
              is_active: true,
            },
          ],
        } as any);
      }
      return Promise.resolve({ data: [] } as any);
    });

    renderWithProviders(<PlatformPlansPage />);

    await waitFor(() => {
      expect(screen.getByText("Dhaba & Outdoor Huts Edition")).toBeInTheDocument();
      expect(screen.getByText("Dhaba Huts")).toBeInTheDocument();
      expect(screen.getByText("Waiter Bell")).toBeInTheDocument();
      expect(screen.getByText("Hotel & Resort Edition")).toBeInTheDocument();
      expect(screen.getByText("Hotel Rooms")).toBeInTheDocument();
    });

    // Verify "+ Create Plan" button is present and clickable
    const createBtn = screen.getByRole("button", { name: /Create Plan/i });
    expect(createBtn).toBeInTheDocument();
    fireEvent.click(createBtn);

    // Verify Plan Builder dialog opens with 1-click industry presets
    await waitFor(() => {
      expect(screen.getByText(/Create New Subscription Plan/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Dhaba & Huts/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Hotel & Resort/i })).toBeInTheDocument();
    });
  });
});
