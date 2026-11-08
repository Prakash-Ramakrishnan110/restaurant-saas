import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ShieldCheck,
  Building2,
  PlusCircle,
  Layers,
  Activity,
  FileText,
  LifeBuoy,
  Megaphone,
} from "lucide-react";

export const PLATFORM_ADMIN_NAV_ITEMS = [
  { label: "Overview", path: "/admin", icon: ShieldCheck },
  { label: "Tenants", path: "/admin/tenants", icon: Building2 },
  { label: "New Customer", path: "/admin/tenants/new", icon: PlusCircle },
  { label: "Subscription Plans", path: "/admin/plans", icon: Layers },
  { label: "System Health", path: "/admin/health", icon: Activity },
  { label: "Audit & Activity", path: "/admin/activity", icon: FileText },
  { label: "Support Desk", path: "/admin/support", icon: LifeBuoy },
  { label: "Announcements", path: "/admin/announcements", icon: Megaphone },
];

export const PlatformAdminNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav
      aria-label="Super Admin Sub-navigation"
      className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border text-xs scrollbar-thin"
    >
      {PLATFORM_ADMIN_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          location.pathname === item.path ||
          (item.path === "/admin" && location.pathname === "/admin/dashboard");

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors min-h-[36px] ${
              isActive
                ? "bg-[#FF6A00] text-[#0B1F3B] shadow-sm font-bold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

