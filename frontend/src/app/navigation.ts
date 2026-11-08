import React from "react";
import {
  LayoutDashboard,
  Utensils,
  ChefHat,
  Receipt,
  UtensilsCrossed,
  Clock,
  QrCode,
  Sparkles,
  GitBranch,
  Layers,
  LayoutGrid,
  Zap,
  Users,
  Palette,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  FileText,
  User,
  Activity,
  PlusCircle,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  badgeKey?: "activeOrders" | "readyOrders";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface NavigationContext {
  role?: string;
  isPlatformAdmin?: boolean;
  businessType?: string;
  venueProfile?: string;
  usesTables?: boolean;
  can: (perm: string) => boolean;
}

export function getNavigationGroups(ctx: NavigationContext): NavGroup[] {
  const { role, isPlatformAdmin, businessType, venueProfile, usesTables = true, can } = ctx;

  const isQuickService =
    !usesTables ||
    businessType === "TEA_SHOP" ||
    businessType === "FOOD_COURT" ||
    venueProfile === "QUICK_SERVICE";

  // 1. Platform Admin role: Platform console only, NEVER restaurant data
  if (isPlatformAdmin) {
    return [
      {
        label: "Super Admin",
        items: [
          { label: "Platform Dashboard", path: "/admin", icon: ShieldCheck },
          { label: "Tenants Directory", path: "/admin/tenants", icon: Users },
          { label: "New Customer", path: "/admin/tenants/new", icon: PlusCircle },
        ],
      },
    ];
  }

  // 2. Kitchen role
  if (role === "KITCHEN") {
    return [
      {
        label: "Kitchen Station",
        items: [
          { label: "Kitchen KDS", path: "/kds", icon: ChefHat, badgeKey: "activeOrders" },
          { label: "Today's Availability", path: "/menu/availability", icon: Clock },
          { label: "Menu", path: "/menu", icon: UtensilsCrossed },
        ],
      },
    ];
  }

  // 3. Waiter role
  if (role === "WAITER") {
    const floorLabel = isQuickService ? "Counter Orders" : "Tables and Orders";
    return [
      {
        label: "Floor Service",
        items: [
          { label: floorLabel, path: "/pos", icon: Utensils },
          { label: "Live Orders", path: "/orders", icon: Activity, badgeKey: "activeOrders" },
          {
            label: isQuickService ? "Ready for Pickup" : "Ready to Serve",
            path: "/serve",
            icon: CheckCircle2,
            badgeKey: "readyOrders",
          },
          { label: "Menu", path: "/menu", icon: UtensilsCrossed },
        ],
      },
    ];
  }

  // 4. Cashier role
  if (role === "CASHIER") {
    return [
      {
        label: "Billing & Register",
        items: [
          { label: "Cashier Billing", path: "/billing", icon: Receipt },
          { label: "Bills", path: "/billing/bills", icon: FileText },
          { label: "Shift Close", path: "/billing/closeout", icon: Clock },
          { label: "Live Orders", path: "/orders", icon: Activity, badgeKey: "activeOrders" },
          { label: "Today's Availability", path: "/menu/availability", icon: Clock },
          { label: "Menu", path: "/menu", icon: UtensilsCrossed },
        ],
      },
    ];
  }

  // 5. Manager & Owner roles (exactly 4 groups: Daily work, Restaurant setup, Team, Settings)
  const isManager = role === "BRANCH_MANAGER";

  const setupVenueItem: NavItem = isQuickService
    ? { label: "Counters and Tokens", path: "/venue/counters", icon: Zap, permission: "area.view" }
    : { label: "Tables", path: "/venue/tables", icon: Utensils, permission: "table.view" };

  const floorPlanItem: NavItem | null = isQuickService
    ? null
    : { label: "Floor Plan", path: "/venue/floor", icon: LayoutGrid, permission: "floor.manage" };

  const dailyItems: NavItem[] = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    {
      label: isQuickService ? "Counter Orders" : "Floor POS",
      path: "/pos",
      icon: Utensils,
      permission: "order.create",
    },
    { label: "Live Orders", path: "/orders", icon: Activity, badgeKey: "activeOrders" },
    {
      label: isQuickService ? "Ready for Pickup" : "Ready to Serve",
      path: "/serve",
      icon: CheckCircle2,
      badgeKey: "readyOrders",
    },
    { label: "Kitchen KDS", path: "/kds", icon: ChefHat, permission: "menu.availability" },
    { label: "Cashier Billing", path: "/billing", icon: Receipt, permission: "order.create" },
    { label: "Bills", path: "/billing/bills", icon: FileText, permission: "order.create" },
    { label: "Shift Close", path: "/billing/closeout", icon: Clock, permission: "order.create" },
    { label: "Menu", path: "/menu", icon: UtensilsCrossed, permission: "menu.view" },
    {
      label: "Today's Availability",
      path: "/menu/availability",
      icon: Clock,
      permission: "menu.availability",
    },
  ];

  const setupItems: NavItem[] = [
    { label: "Onboarding", path: "/onboarding", icon: Sparkles, permission: "business.manage" },
    {
      label: "Branches",
      path: "/branches",
      icon: GitBranch,
      permission: "branch.view",
    },
    {
      label: "Areas",
      path: "/venue/areas",
      icon: Layers,
      permission: "area.view",
    },
    setupVenueItem,
    ...(floorPlanItem ? [floorPlanItem] : []),
    { label: "QR Codes", path: "/qr", icon: QrCode, permission: "qr.view" },
  ];

  const settingsItems: NavItem[] = [
    ...(!isManager
      ? [
          {
            label: "Branding",
            path: "/settings/branding",
            icon: Palette,
            permission: "business.manage",
          },
        ]
      : []),
    {
      label: "Venue Settings",
      path: "/settings/venue",
      icon: Sliders,
      permission: "business.view",
    },
    ...(!isManager
      ? [
          {
            label: "Your Plan & Billing",
            path: "/settings/plan",
            icon: User,
          },
        ]
      : []),
  ];

  const groups: NavGroup[] = [
    {
      label: "Daily work",
      items: dailyItems,
    },
    {
      label: "Restaurant setup",
      items: setupItems,
    },
    {
      label: "Team",
      items: [{ label: "Staff", path: "/staff", icon: Users, permission: "staff.view" }],
    },
    {
      label: "Settings",
      items: settingsItems,
    },
  ];

  // Filter out items lacking required permission
  return groups
    .map((grp) => ({
      ...grp,
      items: grp.items.filter((item) => (!item.permission ? true : can(item.permission))),
    }))
    .filter((grp) => grp.items.length > 0);
}
