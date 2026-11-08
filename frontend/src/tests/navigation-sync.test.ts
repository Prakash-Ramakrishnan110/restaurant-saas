import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { getNavigationGroups, NavigationContext } from "../app/navigation";

describe("Sidebar Map & Navigation Synchronization", () => {
  const sidebarMapPath = path.resolve(__dirname, "../../../docs/product/sidebar-map.md");
  const sidebarContent = fs.readFileSync(sidebarMapPath, "utf-8");

  it("successfully reads docs/product/sidebar-map.md as single source of truth", () => {
    expect(sidebarContent).toBeDefined();
    expect(sidebarContent.length).toBeGreaterThan(100);
    expect(sidebarContent).toContain("# ServeMyFood Sidebar Map");
  });

  it("ensures all NOW and P1 working routes in sidebar-map.md are recognized", () => {
    const lines = sidebarContent.split("\n");
    const workingRoutes: string[] = [];
    for (const line of lines) {
      if (!line.includes("|") || line.includes("---") || line.includes("Item | Route")) continue;
      const parts = line
        .split("|")
        .map((p) => p.trim())
        .filter(Boolean);
      const route = parts.find((p) => p.startsWith("/") && !p.includes(" "));
      const phasePart = parts.find((p) => p.startsWith("NOW") || p.startsWith("P1"));
      if (route && phasePart && !route.includes(":id")) {
        if (!workingRoutes.includes(route)) {
          workingRoutes.push(route);
        }
      }
    }

    expect(workingRoutes).toContain("/dashboard");
    expect(workingRoutes).toContain("/pos");
    expect(workingRoutes).toContain("/orders");
    expect(workingRoutes).toContain("/serve");
    expect(workingRoutes).toContain("/kds");
    expect(workingRoutes).toContain("/billing");
    expect(workingRoutes).toContain("/billing/bills");
    expect(workingRoutes).toContain("/billing/closeout");
    expect(workingRoutes).toContain("/menu");
    expect(workingRoutes).toContain("/menu/availability");
    expect(workingRoutes).toContain("/onboarding");
    expect(workingRoutes).toContain("/branches");
    expect(workingRoutes).toContain("/venue/areas");
    expect(workingRoutes).toContain("/venue/tables");
    expect(workingRoutes).toContain("/venue/counters");
    expect(workingRoutes).toContain("/qr");
    expect(workingRoutes).toContain("/staff");
    expect(workingRoutes).toContain("/settings/branding");
    expect(workingRoutes).toContain("/settings/venue");
    expect(workingRoutes).toContain("/settings/plan");
    expect(workingRoutes).toContain("/admin");
    expect(workingRoutes).toContain("/admin/tenants");
    expect(workingRoutes).toContain("/admin/tenants/new");
  });

  it("platform admin sees strictly platform admin console and zero restaurant operational data", () => {
    const adminCtx: NavigationContext = {
      isPlatformAdmin: true,
      can: () => true,
    };

    const groups = getNavigationGroups(adminCtx);
    expect(groups.length).toBe(1);
    expect(groups[0].label).toBe("Super Admin");

    const paths = groups.flatMap((g) => g.items.map((i) => i.path));
    expect(paths).toEqual(["/admin", "/admin/tenants", "/admin/tenants/new"]);

    // Strictly forbidden from operational restaurant routes
    expect(paths).not.toContain("/pos");
    expect(paths).not.toContain("/billing");
    expect(paths).not.toContain("/orders");
    expect(paths).not.toContain("/kds");
    expect(paths).not.toContain("/dashboard");
    expect(paths).not.toContain("/menu");
  });

  it("owner sees daily work, restaurant setup, team, and settings", () => {
    const ownerCtx: NavigationContext = {
      role: "OWNER",
      usesTables: true,
      can: () => true,
    };

    const groups = getNavigationGroups(ownerCtx);
    const groupLabels = groups.map((g) => g.label);
    expect(groupLabels).toContain("Daily work");
    expect(groupLabels).toContain("Restaurant setup");
    expect(groupLabels).toContain("Team");
    expect(groupLabels).toContain("Settings");

    const allPaths = groups.flatMap((g) => g.items.map((i) => i.path));
    expect(allPaths).toContain("/dashboard");
    expect(allPaths).toContain("/pos");
    expect(allPaths).toContain("/orders");
    expect(allPaths).toContain("/serve");
    expect(allPaths).toContain("/kds");
    expect(allPaths).toContain("/billing");
    expect(allPaths).toContain("/billing/bills");
    expect(allPaths).toContain("/billing/closeout");
    expect(allPaths).toContain("/menu/availability");
    expect(allPaths).toContain("/menu");
    expect(allPaths).toContain("/onboarding");
    expect(allPaths).toContain("/branches");
    expect(allPaths).toContain("/venue/areas");
    expect(allPaths).toContain("/venue/tables");
    expect(allPaths).toContain("/venue/floor");
    expect(allPaths).toContain("/qr");
    expect(allPaths).toContain("/staff");
    expect(allPaths).toContain("/settings/branding");
    expect(allPaths).toContain("/settings/venue");
    expect(allPaths).toContain("/settings/plan");

    // Must not see platform admin
    expect(allPaths).not.toContain("/admin");
  });

  it("enforces venue rules: counter venue shows counters and excludes tables/floor plan", () => {
    const counterCtx: NavigationContext = {
      role: "OWNER",
      businessType: "TEA_SHOP",
      usesTables: false,
      can: () => true,
    };

    const groups = getNavigationGroups(counterCtx);
    const allPaths = groups.flatMap((g) => g.items.map((i) => i.path));

    // Rule N satisfied
    expect(allPaths).toContain("/venue/counters");
    // Rule T excluded
    expect(allPaths).not.toContain("/venue/tables");
    expect(allPaths).not.toContain("/venue/floor");

    // Dynamic labels for counter venue
    const dailyGroup = groups.find((g) => g.label === "Daily work");
    const posItem = dailyGroup?.items.find((i) => i.path === "/pos");
    expect(posItem?.label).toBe("Counter Orders");

    const serveItem = dailyGroup?.items.find((i) => i.path === "/serve");
    expect(serveItem?.label).toBe("Ready for Pickup");
  });

  it("waiter role sees only floor operations and menu", () => {
    const waiterCtx: NavigationContext = {
      role: "WAITER",
      can: () => true,
    };

    const groups = getNavigationGroups(waiterCtx);
    const paths = groups.flatMap((g) => g.items.map((i) => i.path));

    expect(paths).toContain("/pos");
    expect(paths).toContain("/orders");
    expect(paths).toContain("/serve");
    expect(paths).toContain("/menu");

    expect(paths).not.toContain("/billing");
    expect(paths).not.toContain("/settings/branding");
    expect(paths).not.toContain("/staff");
    expect(paths).not.toContain("/admin");
  });

  it("kitchen role sees strictly KDS, availability and menu", () => {
    const kitchenCtx: NavigationContext = {
      role: "KITCHEN",
      can: () => true,
    };

    const groups = getNavigationGroups(kitchenCtx);
    const paths = groups.flatMap((g) => g.items.map((i) => i.path));

    expect(paths).toEqual(["/kds", "/menu/availability", "/menu"]);
    expect(paths).not.toContain("/billing");
    expect(paths).not.toContain("/pos");
    expect(paths).not.toContain("/orders");
  });

  it("cashier role sees cashier billing, bills, shift close, live orders, availability, and menu", () => {
    const cashierCtx: NavigationContext = {
      role: "CASHIER",
      can: () => true,
    };

    const groups = getNavigationGroups(cashierCtx);
    const paths = groups.flatMap((g) => g.items.map((i) => i.path));

    expect(paths).toContain("/billing");
    expect(paths).toContain("/billing/bills");
    expect(paths).toContain("/billing/closeout");
    expect(paths).toContain("/orders");
    expect(paths).toContain("/menu/availability");
    expect(paths).toContain("/menu");

    expect(paths).not.toContain("/settings/branding");
    expect(paths).not.toContain("/admin");
  });

  it("never displays unbuilt future phases (P2, P3, LATER, ADVICE) in active navigation", () => {
    const allRoles: NavigationContext[] = [
      { role: "OWNER", can: () => true },
      { role: "BRANCH_MANAGER", can: () => true },
      { role: "WAITER", can: () => true },
      { role: "CASHIER", can: () => true },
      { role: "KITCHEN", can: () => true },
      { isPlatformAdmin: true, can: () => true },
    ];

    const forbiddenFuturePaths = [
      "/room-service",
      "/billing/room-charges",
      "/reservations",
      "/events",
      "/menu/options",
      "/menu/import",
      "/menu/prices",
      "/offers",
      "/reports/sales",
      "/reports/items",
      "/reports/payments",
      "/reports/orders",
      "/reports/exceptions",
      "/reports/taxes",
      "/inventory",
      "/venue/rooms",
      "/settings/customer-ordering",
      "/documents",
      "/team/shifts",
      "/team/assignments",
      "/my-shift",
      "/settings/approvals",
      "/settings/sound",
      "/settings/devices",
      "/settings/taxes",
      "/settings/payments",
      "/settings/notifications",
      "/settings/integrations",
      "/admin/plans",
      "/admin/subscriptions",
      "/admin/support",
      "/admin/health",
    ];

    for (const ctx of allRoles) {
      const groups = getNavigationGroups(ctx);
      const paths = groups.flatMap((g) => g.items.map((i) => i.path));
      for (const forbidden of forbiddenFuturePaths) {
        expect(paths).not.toContain(forbidden);
      }
    }
  });
});
