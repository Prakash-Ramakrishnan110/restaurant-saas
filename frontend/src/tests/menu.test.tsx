import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { formatPaise, parseRupeesToPaise } from "../lib/money";
import { FoodTypeBadge } from "../components/menu/FoodTypeBadge";
import { QuickAddDialog } from "../components/menu/QuickAddDialog";
import { MenuPage } from "../pages/menu/MenuPage";
import { MenuAvailabilityPage } from "../pages/menu/MenuAvailabilityPage";
import { ThemeProvider } from "../context/ThemeContext";
import * as AuthContextModule from "../context/AuthContext";
import { apiClient } from "../api/client";

vi.mock("../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(),
  setActiveTenantId: vi.fn(),
}));

describe("ServeMyFood Menu Utilities & Components (Prompt 4A)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("formatPaise formats paise into Indian Rupee currency with correct grouping", () => {
    expect(formatPaise(25000)).toBe("₹250");
    expect(formatPaise(25050)).toBe("₹250.50");
    expect(formatPaise(12500000)).toBe("₹1,25,000");
    expect(formatPaise(0)).toBe("₹0");
  });

  it("parseRupeesToPaise converts rupee inputs to integer paise without float inaccuracies", () => {
    expect(parseRupeesToPaise("250")).toBe(25000);
    expect(parseRupeesToPaise("250.50")).toBe(25050);
    expect(parseRupeesToPaise("₹1,25,000")).toBe(12500000);
    expect(parseRupeesToPaise("49.99")).toBe(4999);
  });

  it("FoodTypeBadge renders distinct indicators for VEG, NON_VEG, and EGG", () => {
    const { unmount } = render(<FoodTypeBadge type="VEG" />);
    expect(screen.getByText("Veg")).toBeDefined();
    unmount();

    render(<FoodTypeBadge type="NON_VEG" />);
    expect(screen.getByText("Non-Veg")).toBeDefined();

    render(<FoodTypeBadge type="EGG" />);
    expect(screen.getByText("Contains Egg")).toBeDefined();
  });

  it("QuickAddDialog parses spreadsheet rows with TSV and detects invalid rows", async () => {
    const handleImport = vi.fn();
    render(<QuickAddDialog open={true} onOpenChange={vi.fn()} onImport={handleImport} />);

    const textarea = screen.getByPlaceholderText(/Starters\s+Paneer Tikka/i);
    // Paste valid and invalid rows
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value:
            "Starters\tPaneer Tikka\t250\tVeg\nBeverages\tFilter Coffee\t30\tVeg\n\tBroken Item\t0\tNon-Veg",
        },
      });
    });

    // Valid items preview
    expect(screen.getByText(/2 valid \/ 3 total/i)).toBeDefined();
    expect(screen.getByText("Filter Coffee")).toBeDefined();
    expect(screen.getByText("Paneer Tikka")).toBeDefined();

    // Import button
    const importBtn = screen.getByRole("button", { name: /Import 2 Valid Items/i });
    expect(importBtn).toBeDefined();
    fireEvent.click(importBtn);

    expect(handleImport).toHaveBeenCalledWith([
      { category: "Starters", name: "Paneer Tikka", base_price_paise: 25000, food_type: "VEG" },
      { category: "Beverages", name: "Filter Coffee", base_price_paise: 3000, food_type: "VEG" },
    ]);
  });

  const setupAuth = (role: string, perms: string[]) => {
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
          tenant_name: "Demo Venue",
          tenant_slug: "demo-venue",
          role,
          is_active: true,
        },
      ],
      activeTenant: { tenant_id: "t-1", tenant_name: "Demo Venue", role, is_active: true } as any,
      activeRole: role,
      permissions: perms,
      mustChangePassword: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      selectTenant: vi.fn(),
      changePassword: vi.fn(),
      can: (perm: string) => perms.includes(perm) || perms.includes("*") || role === "OWNER",
    });
  };

  it("MenuPage displays categories, items, and role-based action buttons", async () => {
    setupAuth("OWNER", ["menu.view", "menu.manage"]);

    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes("/menu/categories/")) {
        return Promise.resolve({
          data: { results: [{ id: "c-1", name: "Starters", name_ta: "தொடக்க உணவு" }] },
        });
      }
      if (url.includes("/menu/items/")) {
        return Promise.resolve({
          data: {
            results: [
              {
                id: "i-1",
                category: "c-1",
                name: "Paneer Tikka",
                base_price_paise: 25000,
                food_type: "VEG",
                is_active: true,
                is_bestseller: true,
              },
            ],
          },
        });
      }
      if (url.includes("/menu/option-groups/")) {
        return Promise.resolve({ data: { results: [] } });
      }
      if (url.includes("/subscriptions/entitlements/")) {
        return Promise.resolve({ data: { limits: { max_menu_items: { limit: 100 } } } });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <ThemeProvider>
        <MemoryRouter>
          <MenuPage />
        </MemoryRouter>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Menu Management")).toBeDefined();
      expect(screen.getByText("Paneer Tikka")).toBeDefined();
      expect(screen.getByText("₹250")).toBeDefined();
      expect(screen.getByText("Add Item")).toBeDefined();
      expect(screen.getByText("Quick Add (Paste)")).toBeDefined();
    });
  });

  it("MenuAvailabilityPage renders items and triggers availability toggle", async () => {
    setupAuth("WAITER", ["menu.view", "menu.availability"]);

    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes("/branches/")) {
        return Promise.resolve({
          data: { results: [{ id: "b-1", name: "Main Branch" }] },
        });
      }
      if (url.includes("/menu/categories/")) {
        return Promise.resolve({
          data: { results: [{ id: "c-1", name: "Beverages" }] },
        });
      }
      if (url.includes("/menu/items/")) {
        return Promise.resolve({
          data: {
            results: [
              {
                id: "i-10",
                category: "c-1",
                name: "Masala Chai",
                base_price_paise: 2000,
                food_type: "VEG",
                is_available: true,
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    (apiClient.post as any).mockResolvedValue({ data: { is_available: false } });

    render(
      <ThemeProvider>
        <MemoryRouter>
          <MenuAvailabilityPage />
        </MemoryRouter>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Today's Availability")).toBeDefined();
      expect(screen.getByText("Masala Chai")).toBeDefined();
      expect(screen.getByText("Available")).toBeDefined();
    });

    const toggleSwitch = screen.getByRole("switch");
    fireEvent.click(toggleSwitch);

    expect(apiClient.post).toHaveBeenCalledWith("/menu/availability/toggle/", {
      branch: "b-1",
      item: "i-10",
      is_available: false,
    });
  });
});
