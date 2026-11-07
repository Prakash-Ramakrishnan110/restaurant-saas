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

  const isHotel = venueProfile === "HOTEL";

  // 1. Platform Admin role: Platform group only, NEVER restaurant data
  if (isPlatformAdmin) {
    return [
      {
        label: "Super Admin",
        items: [
          { label: "Platform Overview", path: "/admin/dashboard", icon: ShieldCheck },
          { label: "Tenants Directory", path: "/admin/tenants", icon: Users },
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
          { label: "Kitchen KDS", path: "/kds", icon: ChefHat },
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
            label: "Ready to Serve",
            path: "/orders/ready",
            icon: CheckCircle2,
            badgeKey: "readyOrders",
          },
          { label: "Menu (View Only)", path: "/menu", icon: UtensilsCrossed },
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
          { label: "Bills & Receipts", path: "/billing/invoices", icon: FileText },
          { label: "Shift Closeout", path: "/billing/closeout", icon: Clock },
          { label: "Live Orders", path: "/orders", icon: Activity, badgeKey: "activeOrders" },
          { label: "Today's Availability", path: "/menu/availability", icon: Clock },
          { label: "Menu", path: "/menu", icon: UtensilsCrossed },
        ],
      },
    ];
  }

  // 5. Manager & Owner roles
  const isManager = role === "BRANCH_MANAGER";

  const setupVenueItem: NavItem = isQuickService
    ? { label: "Counters and Tokens", path: "/venue/counters", icon: Zap, permission: "area.view" }
    : isHotel
      ? {
          label: "Floors and Outlets",
          path: "/branches",
          icon: GitBranch,
          permission: "branch.view",
        }
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
    { label: "Ready to Serve", path: "/orders/ready", icon: CheckCircle2, badgeKey: "readyOrders" },
    { label: "Kitchen KDS", path: "/kds", icon: ChefHat, permission: "menu.availability" },
    { label: "Cashier Billing", path: "/billing", icon: Receipt, permission: "order.create" },
    { label: "Menu", path: "/menu", icon: UtensilsCrossed, permission: "menu.view" },
    {
      label: "Today's Availability",
      path: "/menu/availability",
      icon: Clock,
      permission: "menu.availability",
    },
    { label: "QR Codes", path: "/qr", icon: QrCode, permission: "qr.view" },
  ];

  const setupItems: NavItem[] = [
    { label: "Onboarding", path: "/onboarding", icon: Sparkles, permission: "business.manage" },
    { label: "Branches", path: "/branches", icon: GitBranch, permission: "branch.view" },
    { label: "Areas", path: "/venue/areas", icon: Layers, permission: "area.view" },
    setupVenueItem,
    ...(floorPlanItem ? [floorPlanItem] : []),
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
    { label: "Account & Plan", path: "/settings/account", icon: User },
  ];

  const groups: NavGroup[] = [
    {
      label: "Daily work",
      items: dailyItems,
    },
    {
      label: "Bills & Reports",
      items: [
        {
          label: "Bills & Receipts",
          path: "/billing/invoices",
          icon: FileText,
          permission: "order.create",
        },
        {
          label: "Shift Closeout",
          path: "/billing/closeout",
          icon: Clock,
          permission: "order.create",
        },
      ],
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
