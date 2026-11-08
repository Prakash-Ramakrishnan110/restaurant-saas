import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { RoomsPage } from "../pages/venue/RoomsPage";
import { RoomServicePage } from "../pages/orders/RoomServicePage";
import { RoomChargesPage } from "../pages/billing/RoomChargesPage";
import { TakeawayPage } from "../pages/orders/TakeawayPage";
import { ExceptionsReportPage } from "../pages/reports/ExceptionsReportPage";
import { StaffReportPage } from "../pages/reports/StaffReportPage";
import { OutletComparisonPage } from "../pages/reports/OutletComparisonPage";
import { CustomersPage } from "../pages/customers/CustomersPage";
import { RolesGuidePage } from "../pages/team/RolesGuidePage";
import { PlatformSupportPage } from "../pages/admin/PlatformSupportPage";
import { PlatformAnnouncementsPage } from "../pages/admin/PlatformAnnouncementsPage";
import { PlatformHealthPage } from "../pages/admin/PlatformHealthPage";
import { apiClient } from "../api/client";

vi.mock("../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Phase 2 (P2) Feature Suite & Hotel Operations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders RoomsPage with hotel room grid and occupancy stats (H-03, H-05)", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === "/sections/") {
        return Promise.resolve({
          data: [{ id: "sec-1", name: "1st Floor" }],
        });
      }
      if (url === "/tables/") {
        return Promise.resolve({
          data: [
            {
              id: "t-101",
              label: "Room 101",
              table_type: "ROOM",
              capacity: 2,
              status: "AVAILABLE",
              section: "sec-1",
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <BrowserRouter>
        <RoomsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Hotel Rooms & Suites")).toBeDefined();
      expect(screen.getByText("Room 101")).toBeDefined();
      expect(screen.getByText("Total Rooms")).toBeDefined();
    });
  });

  it("renders RoomServicePage with elapsed timers and late alerts (H-06)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        {
          id: "ord-rs-1",
          order_number: "RS-1001",
          order_workflow: "ROOM_SERVICE",
          status: "PLACED",
          table_label: "Room 302",
          placed_at: new Date(Date.now() - 30 * 60000).toISOString(), // 30m ago (Late)
          items: [{ id: "it-1", item_name: "Club Sandwich", quantity: 2 }],
        },
      ],
    });

    render(
      <BrowserRouter>
        <RoomServicePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Room Service Dispatch")).toBeDefined();
      expect(screen.getByText("Room 302")).toBeDefined();
      expect(screen.getByText(/running past 25 minutes/i)).toBeDefined();
    });
  });

  it("renders RoomChargesPage with folio verified badge and paise amounts (H-05)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        {
          id: "inv-rc-1",
          invoice_number: "INV-FOLIO-01",
          table_label: "Room 204",
          settled_at: new Date().toISOString(),
          total_paise: 85000,
          payment_method: "ROOM_FOLIO",
          customer_name: "Meenakshi Raman",
        },
      ],
    });

    render(
      <BrowserRouter>
        <RoomChargesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Front Desk Room Charges Folio")).toBeDefined();
      expect(screen.getByText("INV-FOLIO-01")).toBeDefined();
      expect(screen.getAllByText("₹850.00").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Signed & Verified")).toBeDefined();
    });
  });

  it("renders TakeawayPage with token slip and 4-digit pickup code (R-09)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        {
          id: "ord-tk-1",
          order_number: "ORD-9421",
          order_workflow: "TAKEAWAY",
          status: "READY",
          table_label: "Token #42",
          placed_at: new Date().toISOString(),
          items: [{ id: "it-1", item_name: "Masala Dosa", quantity: 2 }],
          pickup_code: "9421",
        },
      ],
    });

    render(
      <BrowserRouter>
        <TakeawayPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Takeaway & Parcel Counter")).toBeDefined();
      expect(screen.getByText("Token #42")).toBeDefined();
      expect(screen.getByText("9421")).toBeDefined();
      expect(screen.getByText("Verify Code & Hand Over")).toBeDefined();
    });
  });

  it("renders ExceptionsReportPage with discount and void audit trails (H-01)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        start_date: "2026-11-01",
        end_date: "2026-11-08",
        total_discount_paise: 15000,
        discounted_invoices_count: 3,
        cancelled_orders_count: 1,
        reprints_count: 2,
        discounts: [
          {
            id: "d-1",
            invoice_number: "INV-101",
            discount_paise: 5000,
            total_paise: 45000,
            settled_by_name: "Manager Suresh",
            settled_at: new Date().toISOString(),
          },
        ],
        cancellations: [],
        reprints: [],
      },
    });

    render(
      <BrowserRouter>
        <ExceptionsReportPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Operational Exceptions Audit")).toBeDefined();
      expect(screen.getAllByText("₹150.00").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("INV-101")).toBeDefined();
    });
  });

  it("renders StaffReportPage with settled bills and average ticket (H-22)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        start_date: "2026-11-01",
        end_date: "2026-11-08",
        staff: [
          {
            user_id: "u-1",
            full_name: "Kavitha Raj",
            role: "CASHIER",
            settled_count: 24,
            total_sales_paise: 1200000,
            average_ticket_paise: 50000,
          },
        ],
      },
    });

    render(
      <BrowserRouter>
        <StaffReportPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Staff Performance & Register Audit")).toBeDefined();
      expect(screen.getByText("Kavitha Raj")).toBeDefined();
      expect(screen.getAllByText("₹12,000.00").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("₹500.00").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders OutletComparisonPage with multi-branch breakdown (H-21)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        start_date: "2026-11-01",
        end_date: "2026-11-08",
        outlets: [
          {
            branch_id: "b-1",
            name: "Lobby Cafe",
            venue_profile: "CAFE",
            invoices_count: 50,
            total_sales_paise: 2500000,
            average_ticket_paise: 50000,
          },
          {
            branch_id: "b-2",
            name: "Rooftop Restaurant",
            venue_profile: "FINE_DINING",
            invoices_count: 30,
            total_sales_paise: 3500000,
            average_ticket_paise: 116666,
          },
        ],
      },
    });

    render(
      <BrowserRouter>
        <OutletComparisonPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Multi-Outlet Revenue Comparison")).toBeDefined();
      expect(screen.getAllByText("Lobby Cafe").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Rooftop Restaurant").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders CustomersPage with guest dietary preferences and privacy consent (H-24)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        {
          id: "cust-1",
          name: "Dr. Vikram Seth",
          phone: "+919876543210",
          email: "vikram@example.com",
          consent_given: true,
          dietary_preference: "JAIN",
          allergies: "Nuts",
          notes: "Regular dinner guest",
          visit_count: 8,
          total_spend_paise: 320000,
          last_visit_at: new Date().toISOString(),
        },
      ],
    });

    render(
      <BrowserRouter>
        <CustomersPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Guest Profiles & VIP Loyalty")).toBeDefined();
      expect(screen.getByText("Dr. Vikram Seth")).toBeDefined();
      expect(screen.getAllByText("JAIN").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Allergic: Nuts")).toBeDefined();
    });
  });

  it("renders RolesGuidePage with bilingual English and Tamil duties (H-09)", () => {
    render(
      <BrowserRouter>
        <RolesGuidePage />
      </BrowserRouter>
    );

    expect(screen.getByText("Staff Roles & Rapid Training Guide")).toBeDefined();
    expect(screen.getAllByText(/பணிப்பாளர்/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/உரிமையாளர்/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders PlatformSupportPage, Announcements, and System Health (A-04, A-05, A-06)", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === "/support-tickets/") {
        return Promise.resolve({
          data: [
            {
              id: "st-1",
              subject: "Printer issue",
              description: "Cannot connect to Kitchen printer",
              status: "OPEN",
              priority: "HIGH",
              contact_phone: "+919876543210",
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      if (url === "/announcements/") {
        return Promise.resolve({
          data: [
            {
              id: "an-1",
              title: "Upgrade scheduled",
              message: "Maintenance Sunday 2 AM",
              announcement_type: "MAINTENANCE",
              is_active: true,
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      if (url === "/health/") {
        return Promise.resolve({ status: 200, data: { status: "OK" } });
      }
      if (url === "/platform/summary/") {
        return Promise.resolve({
          data: {
            total_tenants: 12,
            active_tenants: 11,
            suspended_tenants: 1,
            new_this_week: 3,
            plan_distribution: { Starter: 5, Professional: 6 },
            mrr_paise: 9500000,
            api_health: "HEALTHY",
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    const { unmount: unmount1 } = render(
      <BrowserRouter>
        <PlatformSupportPage />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Platform Support & Incident Desk")).toBeDefined();
      expect(screen.getByText("Printer issue")).toBeDefined();
    });
    unmount1();

    const { unmount: unmount2 } = render(
      <BrowserRouter>
        <PlatformAnnouncementsPage />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Platform Broadcasts & Announcements")).toBeDefined();
      expect(screen.getByText("Upgrade scheduled")).toBeDefined();
    });
    unmount2();

    render(
      <BrowserRouter>
        <PlatformHealthPage />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("System Health & Infrastructure Monitor")).toBeDefined();
      expect(screen.getByText("All Systems Operational")).toBeDefined();
    });
  });
});
