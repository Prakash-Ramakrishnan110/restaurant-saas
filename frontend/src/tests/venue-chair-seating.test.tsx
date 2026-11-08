// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TablesPage } from "../pages/venue/TablesPage";
import { FloorPlanPage } from "../pages/venue/FloorPlanPage";
import { apiClient } from "../api/client";

// Mock AuthContext
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    can: () => true,
    activeTenant: { tenant_id: "tenant-123", name: "Kaveri Cafe" },
    user: { id: "u-1", name: "Owner" },
  }),
}));

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "tables.title": "Dining Tables",
        "tables.subtitle": "Manage restaurant tables and seating layout",
        "tables.addTable": "Add Table",
        "tables.bulkCreate": "Bulk Create Tables",
        "tables.seats": "Seats",
        "tables.shape": "Shape",
        "tables.label": "Table Label",
        "common.cancel": "Cancel",
        "common.save": "Save",
        "floorPlan.title": "Live Floor Plan",
        "floorPlan.subtitle": "Interactive table and chair status overview",
        "floorPlan.tableDetails": "Table Details",
      };
      return translations[key] || key;
    },
  }),
}));

describe("Venue Chair Seating & Table Presets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Add Table dialog with 4-Seater and 6-Seater chair presets and live preview", async () => {
    vi.spyOn(apiClient, "get").mockImplementation((url: string) => {
      if (url.includes("/sections")) {
        return Promise.resolve({
          data: [{ id: "sec-1", name: "Main Dining", color: "#3B82F6" }],
        });
      }
      if (url.includes("/tables")) {
        return Promise.resolve({
          data: {
            results: [
              {
                id: "tbl-1",
                label: "T-01",
                capacity: 4,
                shape: "SQUARE",
                table_type: "TABLE",
                is_combinable: true,
                is_active: true,
                status: "AVAILABLE",
                section: { id: "sec-1", name: "Main Dining" },
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <MemoryRouter>
        <TablesPage />
      </MemoryRouter>
    );

    // Verify 4-Seater badge in table list
    await waitFor(() => {
      expect(screen.getByText("4-Seater")).toBeInTheDocument();
      expect(screen.getByText("4 Chairs")).toBeInTheDocument();
    });

    // Open Add Table dialog
    const addBtn = screen.getByText("Add Table");
    fireEvent.click(addBtn);

    // Verify chair preset buttons exist in dialog
    expect(screen.getAllByRole("button", { name: "4-Seater" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: "6-Seater" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: "2-Seater" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: "8-Seater" }).length).toBeGreaterThanOrEqual(1);

    // Verify live seating preview is rendered
    expect(screen.getByText(/Live Seating Preview/i)).toBeInTheDocument();

    // Click 6-Seater preset button
    const sixSeaterBtn = screen.getAllByRole("button", { name: "6-Seater" })[0];
    fireEvent.click(sixSeaterBtn);

    // Now capacity should update and 6 chairs should appear in the preview
    await waitFor(() => {
      expect(screen.getByText(/6 Chairs/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Seat 6/i })).toBeInTheDocument();
    });
  });

  it("renders FloorPlanPage with realistic docked chairs and interactive chair selection", async () => {
    vi.spyOn(apiClient, "get").mockImplementation((url: string) => {
      if (url.includes("/sections")) {
        return Promise.resolve({
          data: [{ id: "sec-1", name: "Main Dining", color: "#3B82F6" }],
        });
      }
      if (url.includes("/tables")) {
        return Promise.resolve({
          data: {
            results: [
              {
                id: "tbl-4",
                label: "T-04",
                capacity: 4,
                shape: "SQUARE",
                status: "AVAILABLE",
                is_active: true,
                section: { id: "sec-1", name: "Main Dining" },
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <MemoryRouter>
        <FloorPlanPage />
      </MemoryRouter>
    );

    // Floor plan renders table T-04 with 4 perimeter chairs
    await waitFor(() => {
      expect(screen.getByText("T-04")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Seat 1/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Seat 2/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Seat 3/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Seat 4/i })).toBeInTheDocument();
    });

    // Clicking Chair 3 opens side sheet and selects Chair 3
    const chair3 = screen.getByRole("button", { name: /Seat 3/i });
    fireEvent.click(chair3);

    await waitFor(() => {
      expect(screen.getByText("Table Details")).toBeInTheDocument();
      expect(screen.getByText("4-Seater Format")).toBeInTheDocument();
      expect(screen.getByText(/Chair #3/i)).toBeInTheDocument();
    });
  });
});
