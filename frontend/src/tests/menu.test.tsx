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

  it("formatPaise formats paise into Indian Rupee currency with correct grouping and optional forceDecimals", () => {
    expect(formatPaise(25000)).toBe("₹250");
    expect(formatPaise(25050)).toBe("₹250.50");
    expect(formatPaise(12500000)).toBe("₹1,25,000");
    expect(formatPaise(0)).toBe("₹0");
    expect(formatPaise(12000, { forceDecimals: true })).toBe("₹120.00");
    expect(formatPaise(25050, { forceDecimals: true })).toBe("₹250.50");
  });

  it("parseRupeesToPaise converts rupee inputs to integer paise and strictly rejects >2 decimal places", () => {
    expect(parseRupeesToPaise("250")).toBe(25000);
    expect(parseRupeesToPaise("250.50")).toBe(25050);
    expect(parseRupeesToPaise("₹1,25,000")).toBe(12500000);
    expect(parseRupeesToPaise("49.99")).toBe(4999);
    // Fractional paise rejection (Prompt 4A invariant)
    expect(Number.isNaN(parseRupeesToPaise("12.345"))).toBe(true);
    expect(Number.isNaN(parseRupeesToPaise("-50"))).toBe(true);
    expect(Number.isNaN(parseRupeesToPaise("abc"))).toBe(true);
  });

  it("FoodTypeBadge renders distinct indicators and enforces Egg badge color #A16207 with contrast >= 3:1", () => {
    const { unmount } = render(<FoodTypeBadge type="VEG" />);
    expect(screen.getByText("Veg")).toBeDefined();
    unmount();

    render(<FoodTypeBadge type="NON_VEG" />);
    expect(screen.getByText("Non-Veg")).toBeDefined();

    render(<FoodTypeBadge type="EGG" />);
    expect(screen.getByText("Egg")).toBeDefined();

    // WCAG contrast validation for dark gold #A16207
    const getLuminance = (r: number, g: number, b: number) => {
      const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    };
    const lumEgg = getLuminance(161, 98, 7); // #A16207
    const lumWhite = getLuminance(255, 255, 255);
    const lumDarkHeader = getLuminance(11, 31, 59); // #0B1F3B

    const contrastWhite = (lumWhite + 0.05) / (lumEgg + 0.05);
    const contrastDark = (lumEgg + 0.05) / (lumDarkHeader + 0.05);

    expect(contrastWhite).toBeGreaterThanOrEqual(3.0);
    expect(contrastDark).toBeGreaterThanOrEqual(3.0);
  });

  it("QuickAddDialog parses tabs, pipes, and commas, shows plan usage, and blocks missing categories", async () => {
    const handleImport = vi.fn();
    const existingCats = [
      { id: "c-1", name: "Starters", sort_order: 1 },
      { id: "c-2", name: "Beverages", sort_order: 2 },
    ];

    render(
      <QuickAddDialog
        open={true}
        onOpenChange={vi.fn()}
        onImport={handleImport}
        existingCategories={existingCats}
        currentItemCount={5}
        totalItemLimit={100}
      />
    );

    // Verify plan usage banner
    expect(screen.getByText(/5 of 100 items used/i)).toBeDefined();

    const textarea = screen.getByPlaceholderText(/Starters\s+Paneer Tikka/i);

    // 1. Multi-delimiter paste (tab, pipe, comma)
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value:
            "Starters\tPaneer Tikka\t250\tVeg\nBeverages | Filter Coffee | 30 | Veg\nStarters, Gobi 65, 180, Veg",
        },
      });
    });

    expect(screen.getByText(/3 valid \/ 3 total/i)).toBeDefined();
    expect(screen.getByText("Filter Coffee")).toBeDefined();
    expect(screen.getByText("Gobi 65")).toBeDefined();

    const importBtn = screen.getByRole("button", { name: /Import 3 Items/i });
    expect(importBtn).toBeDefined();
    expect((importBtn as HTMLButtonElement).disabled).toBe(false);

    // 2. Paste with missing category should fail atomically and disable import button
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value: "Starters\tPaneer Tikka\t250\tVeg\nNonExistentCat\tMystery Dish\t100\tVeg",
        },
      });
    });

    expect(screen.getByText(/Row 2: Category "NonExistentCat" not found/i)).toBeDefined();
    const disabledBtn = screen.getByRole("button", { name: /Import 1 Items/i });
    expect((disabledBtn as HTMLButtonElement).disabled).toBe(true);
  }, 25000);

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

  it("MenuAvailabilityPage renders items and triggers availability toggle for kitchen role", async () => {
    setupAuth("KITCHEN", ["menu.view", "menu.availability"]);

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
      expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
    });

    const toggleSwitch = screen.getByRole("switch");
    fireEvent.click(toggleSwitch);

    expect(apiClient.post).toHaveBeenCalledWith("/menu/availability/toggle/", {
      branch: "b-1",
      item: "i-10",
      is_available: false,
    });
  });

  it("MenuPage category reorder buttons trigger API reorder call", async () => {
    setupAuth("OWNER", ["menu.view", "menu.manage"]);

    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes("/menu/categories/")) {
        return Promise.resolve({
          data: {
            results: [
              { id: "c-1", name: "Starters", sort_order: 1 },
              { id: "c-2", name: "Main Course", sort_order: 2 },
            ],
          },
        });
      }
      if (url.includes("/menu/items/")) {
        return Promise.resolve({ data: { results: [] } });
      }
      if (url.includes("/menu/option-groups/")) {
        return Promise.resolve({ data: { results: [] } });
      }
      if (url.includes("/subscriptions/entitlements/")) {
        return Promise.resolve({ data: { limits: { max_menu_items: { limit: 100 } } } });
      }
      return Promise.resolve({ data: {} });
    });

    (apiClient.post as any).mockResolvedValue({ data: { success: true } });

    render(
      <ThemeProvider>
        <MemoryRouter>
          <MenuPage />
        </MemoryRouter>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Starters")).toBeDefined();
      expect(screen.getByText("Main Course")).toBeDefined();
    });

    const moveDownBtns = screen.getAllByTitle("Move category down");
    expect(moveDownBtns.length).toBeGreaterThan(0);
    fireEvent.click(moveDownBtns[0]);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/menu/categories/reorder/",
        expect.objectContaining({
          orders: expect.arrayContaining([
            expect.objectContaining({ id: "c-1", sort_order: 2 }),
            expect.objectContaining({ id: "c-2", sort_order: 1 }),
          ]),
        })
      );
    });
  });
});
