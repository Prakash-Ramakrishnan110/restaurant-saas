import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { apiClient } from "../api/client";
import * as AuthContextModule from "../context/AuthContext";
import { StockOverviewPage } from "../pages/inventory/StockOverviewPage";
import { RecipesPage } from "../pages/inventory/RecipesPage";
import { SuppliersPurchasesPage } from "../pages/inventory/SuppliersPurchasesPage";
import { WastagePage } from "../pages/inventory/WastagePage";
import { InventoryReportsPage } from "../pages/inventory/InventoryReportsPage";

describe("Stage A Inventory Core Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: {
        id: "u-1",
        email: "owner@example.com",
        full_name: "Owner",
        is_platform_admin: false,
      },
      memberships: [],
      activeTenant: null,
      activeRole: "OWNER",
      permissions: ["*"],
      mustChangePassword: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      selectTenant: vi.fn(),
      changePassword: vi.fn(),
      can: () => true,
    });
  });

  it("renders StockOverviewPage with items, low/negative badges, and server cost fields", async () => {
    vi.spyOn(apiClient, "get").mockImplementation((url: string) => {
      if (url.includes("/inventory/items/")) {
        return Promise.resolve({
          data: {
            results: [
              {
                id: "item-1",
                name: "Basmati Rice",
                name_ta: "பாசுமதி அரிசி",
                item_type: "INGREDIENT",
                base_unit: "g",
                category: "GRAINS_FLOUR",
                is_active: true,
                reorder_level: "5000.000",
                par_level: "20000.000",
                current_quantity: "25000.000",
                weighted_avg_cost_paise: 12,
                stock_value_paise: 300000,
                is_low_stock: false,
                is_negative_stock: false,
              },
              {
                id: "item-2",
                name: "Fresh Paneer",
                item_type: "INGREDIENT",
                base_unit: "g",
                category: "DAIRY",
                is_active: true,
                reorder_level: "5000.000",
                par_level: "10000.000",
                current_quantity: "2000.000",
                weighted_avg_cost_paise: 35,
                stock_value_paise: 70000,
                is_low_stock: true,
                is_negative_stock: false,
              },
            ],
            count: 2,
          },
        });
      }
      return Promise.resolve({ data: { failed_deductions: [] } });
    });

    render(
      <MemoryRouter>
        <StockOverviewPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Basmati Rice")).toBeInTheDocument();
      expect(screen.getByText("Fresh Paneer")).toBeInTheDocument();
      expect(screen.getByText("Low Stock")).toBeInTheDocument();
      expect(screen.getByText("In Stock")).toBeInTheDocument();
      expect(screen.getByText("₹3,000.00")).toBeInTheDocument();
    });
  });

  it("renders RecipesPage with cost per portion and margin % for owner", async () => {
    vi.spyOn(apiClient, "get").mockImplementation((url: string) => {
      if (url.includes("/inventory/recipes/")) {
        return Promise.resolve({
          data: {
            results: [
              {
                id: "rec-1",
                menu_item: "menu-1",
                menu_item_name: "Chicken Biryani",
                variant_name: "",
                output_item_name: "",
                yield_portions: "1.000",
                version: 1,
                cost_per_portion_paise: 7500,
                margin_percent: "73.2",
                lines: [
                  {
                    id: "ln-1",
                    item_name: "Basmati Rice",
                    base_unit: "g",
                    quantity_per_portion: "200.000",
                    waste_percent: "5.00",
                  },
                ],
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: { results: [] } });
    });

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Chicken Biryani")).toBeInTheDocument();
      expect(screen.getByText(/Margin: 73.2%/i)).toBeInTheDocument();
    });
  });

  it("renders SuppliersPurchasesPage, WastagePage, and InventoryReportsPage cleanly", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { results: [], rows: [], by_reason: [] },
    });

    render(
      <MemoryRouter>
        <SuppliersPurchasesPage />
        <WastagePage />
        <InventoryReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Suppliers & Orders/i)).toBeInTheDocument();
      expect(screen.getByText(/Log Wastage/i)).toBeInTheDocument();
      expect(screen.getByText(/Inventory Reports/i)).toBeInTheDocument();
    });
  });
});
