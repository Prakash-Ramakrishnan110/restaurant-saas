import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { apiClient } from "../api/client";
import { StockOverviewPage } from "../pages/inventory/StockOverviewPage";
import { RecipesPage } from "../pages/inventory/RecipesPage";
import { SuppliersPurchasesPage } from "../pages/inventory/SuppliersPurchasesPage";
import { WastagePage } from "../pages/inventory/WastagePage";
import { InventoryReportsPage } from "../pages/inventory/InventoryReportsPage";

describe("Phase 3 (P3) Inventory & Supply Chain Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders StockOverviewPage with live valuation and low-stock alert badges", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: {
        results: [
          {
            id: "ing-1",
            name: "Basmati Rice",
            name_ta: "பாசுமதி அரிசி",
            sku: "RIC-01",
            category: "DRY_GOODS",
            unit: "KG",
            cost_paise: 12000,
            current_stock: "25.000",
            min_threshold: "5.000",
            is_active: true,
            is_low_stock: false,
            stock_value_paise: 300000,
          },
          {
            id: "ing-2",
            name: "Fresh Paneer",
            category: "DAIRY",
            unit: "KG",
            cost_paise: 35000,
            current_stock: "2.000",
            min_threshold: "5.000",
            is_active: true,
            is_low_stock: true,
            stock_value_paise: 70000,
          },
        ],
        count: 2,
      },
    });

    render(
      <MemoryRouter>
        <StockOverviewPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Inventory Stock Overview/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Basmati Rice")).toBeInTheDocument();
      expect(screen.getByText("Fresh Paneer")).toBeInTheDocument();
      expect(screen.getByText("Low Stock")).toBeInTheDocument();
      expect(screen.getByText("In Stock")).toBeInTheDocument();
      expect(screen.getByText("₹3,700.00")).toBeInTheDocument(); // total valuation
    });
  });

  it("renders RecipesPage with menu item costing and gross margin %", async () => {
    vi.spyOn(apiClient, "get").mockImplementation((url: string) => {
      if (url.includes("/inventory/recipes/")) {
        return Promise.resolve({
          data: {
            results: [
              {
                id: "rec-1",
                menu_item: "menu-1",
                menu_item_name: "Chicken Biryani",
                menu_item_price_paise: 28000,
                yield_servings: "1.00",
                total_cost_paise: 7500,
                items: [
                  {
                    ingredient: "ing-1",
                    ingredient_name: "Basmati Rice",
                    ingredient_unit: "KG",
                    quantity: "0.200",
                    calculated_cost_paise: 2400,
                  },
                ],
              },
            ],
            count: 1,
          },
        });
      }
      return Promise.resolve({ data: { results: [], count: 0 } });
    });

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Recipe Formulations & Costing/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Chicken Biryani")).toBeInTheDocument();
      expect(screen.getByText("₹280.00")).toBeInTheDocument(); // selling price
      expect(screen.getByText("₹75.00")).toBeInTheDocument(); // recipe cost
      expect(screen.getByText("73%")).toBeInTheDocument(); // (28000 - 7500) / 28000 = 73%
    });
  });

  it("renders SuppliersPurchasesPage with purchase orders and inward stock receiving", async () => {
    vi.spyOn(apiClient, "get").mockImplementation((url: string) => {
      if (url.includes("/inventory/purchases/")) {
        return Promise.resolve({
          data: {
            results: [
              {
                id: "po-1",
                order_number: "PO-2026-001",
                supplier_name: "Metro Cash & Carry",
                status: "DRAFT",
                invoice_number: "INV-9901",
                total_cost_paise: 150000,
                items: [
                  {
                    ingredient: "ing-1",
                    quantity: "10.000",
                    unit_price_paise: 15000,
                    subtotal_paise: 150000,
                  },
                ],
                created_at: new Date().toISOString(),
              },
            ],
            count: 1,
          },
        });
      }
      return Promise.resolve({ data: { results: [], count: 0 } });
    });

    render(
      <MemoryRouter>
        <SuppliersPurchasesPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Purchases & Supplier Directory/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("PO-2026-001")).toBeInTheDocument();
      expect(screen.getByText("Metro Cash & Carry")).toBeInTheDocument();
      expect(screen.getByText("₹1,500.00")).toBeInTheDocument();
      expect(screen.getByText("Receive & Stock")).toBeInTheDocument();
    });
  });

  it("renders WastagePage with damage incidents and financial loss total", async () => {
    vi.spyOn(apiClient, "get").mockImplementation((url: string) => {
      if (url.includes("/inventory/wastage/")) {
        return Promise.resolve({
          data: {
            results: [
              {
                id: "w-1",
                ingredient: "ing-1",
                ingredient_name: "Fresh Milk",
                ingredient_unit: "LITER",
                quantity: "4.000",
                reason: "EXPIRED",
                cost_loss_paise: 24000,
                notes: "Chiller power surge",
                logged_by_name: "Suresh",
                created_at: new Date().toISOString(),
              },
            ],
            count: 1,
          },
        });
      }
      return Promise.resolve({ data: { results: [], count: 0 } });
    });

    render(
      <MemoryRouter>
        <WastagePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Kitchen Wastage & Spoilage Log/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Fresh Milk")).toBeInTheDocument();
      expect(screen.getAllByText("Expired / Date Passed").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("₹240.00").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders InventoryReportsPage with food cost percentage and low-stock replenishment alert", async () => {
    vi.spyOn(apiClient, "get").mockImplementation((url: string) => {
      if (url.includes("/inventory/reports/variance/")) {
        return Promise.resolve({
          data: {
            total_food_sales_paise: 1000000, // ₹10,000
            theoretical_cogs_paise: 280000, // ₹2,800
            total_wastage_loss_paise: 20000, // ₹200
            effective_cogs_paise: 300000, // ₹3,000
            food_cost_percentage: 30.0,
            ingredients_breakdown: [
              {
                ingredient_id: "ing-1",
                name: "Basmati Rice",
                category: "DRY_GOODS",
                unit: "KG",
                cost_paise: 12000,
                current_stock: 45,
                inward_purchased_qty: 50,
                theoretical_used_qty: 5,
                wasted_qty: 0,
                theoretical_cost_paise: 60000,
                wastage_cost_paise: 0,
                stock_value_paise: 540000,
                is_low_stock: false,
              },
            ],
          },
        });
      }
      if (url.includes("/inventory/reports/low-stock/")) {
        return Promise.resolve({
          data: [
            {
              ingredient_id: "ing-2",
              ingredient_name: "Red Onions",
              ingredient_name_ta: "வெங்காயம்",
              category: "VEGETABLE",
              unit: "KG",
              current_stock: 3.0,
              min_threshold: 15.0,
              deficit: 12.0,
              recommended_reorder_qty: 19.5,
              cost_paise: 4000,
              estimated_reorder_cost_paise: 78000,
            },
          ],
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter>
        <InventoryReportsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Inventory Variance & Food Cost Analysis/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("30%")).toBeInTheDocument(); // Food cost %
      expect(screen.getByText("Optimal")).toBeInTheDocument();
      expect(screen.getByText("Red Onions")).toBeInTheDocument();
      expect(screen.getByText("Deficit: 12 KG")).toBeInTheDocument();
      expect(screen.getByText("₹780.00")).toBeInTheDocument(); // estimated reorder cost
    });
  });
});
