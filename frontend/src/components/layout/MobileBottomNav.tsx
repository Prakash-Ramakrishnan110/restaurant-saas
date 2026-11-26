import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BellRing,
  ClipboardList,
  Grid,
  LayoutDashboard,
  Menu,
  Receipt,
  UtensilsCrossed,
  BedDouble,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export interface MobileTabItem {
  label: string;
  labelTa: string;
  path: string;
  icon: React.FC<{ className?: string }>;
  badge?: number;
}

interface MobileBottomNavProps {
  role: string | null;
  allowsRoomService: boolean;
  readyCount: number;
  liveOrdersCount: number;
  onOpenMore: () => void;
  moreOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  role,
  allowsRoomService,
  readyCount,
  liveOrdersCount,
  onOpenMore,
  moreOpen,
}) => {
  const { i18n } = useTranslation();
  const isTa = i18n.language.startsWith("ta");
  const location = useLocation();

  const buildTabs = (): MobileTabItem[] => {
    if (role === "KITCHEN") {
      return [
        { label: "KDS", labelTa: "சமையல்", path: "/kds", icon: UtensilsCrossed },
        { label: "Availability", labelTa: "இருப்பு", path: "/menu/availability", icon: Grid },
        {
          label: "Orders",
          labelTa: "ஆர்டர்",
          path: "/orders/live",
          icon: ClipboardList,
          badge: liveOrdersCount,
        },
      ];
    }
    if (role === "CASHIER") {
      return [
        { label: "Billing", labelTa: "பில்லிங்", path: "/billing", icon: Receipt },
        {
          label: "Orders",
          labelTa: "ஆர்டர்",
          path: "/orders/live",
          icon: ClipboardList,
          badge: liveOrdersCount,
        },
        {
          label: "Ready",
          labelTa: "தயார்",
          path: "/orders/ready",
          icon: BellRing,
          badge: readyCount,
        },
      ];
    }
    if (role === "OWNER" || role === "BRANCH_MANAGER") {
      return [
        { label: "Home", labelTa: "முகப்பு", path: "/dashboard", icon: LayoutDashboard },
        { label: "POS", labelTa: "POS", path: "/pos", icon: Grid },
        {
          label: "Orders",
          labelTa: "ஆர்டர்",
          path: "/orders/live",
          icon: ClipboardList,
          badge: liveOrdersCount,
        },
        { label: "Billing", labelTa: "பில்", path: "/billing", icon: Receipt },
      ];
    }
    // WAITER (primary APK role) & default
    const waiterTabs: MobileTabItem[] = [
      { label: "Floor POS", labelTa: "மேசை POS", path: "/pos", icon: Grid },
      {
        label: "Orders",
        labelTa: "ஆர்டர்கள்",
        path: "/orders/live",
        icon: ClipboardList,
        badge: liveOrdersCount,
      },
      {
        label: "Ready",
        labelTa: "தயார்",
        path: "/orders/ready",
        icon: BellRing,
        badge: readyCount,
      },
    ];
    if (allowsRoomService) {
      waiterTabs.push({
        label: "Rooms",
        labelTa: "அறைகள்",
        path: "/orders/room-service",
        icon: BedDouble,
      });
    }
    return waiterTabs;
  };

  const tabs = buildTabs();

  return (
    <nav
      aria-label="Mobile app navigation"
      data-testid="mobile-bottom-nav"
      className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)] select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around h-[64px] px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = !moreOpen && location.pathname.startsWith(tab.path);
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] rounded-lg transition-colors ${
                isActive
                  ? "text-[#FF6A00] font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-[#FF6A00]" />
              )}
              <div className="relative">
                <Icon className="h-5 w-5" />
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6A00] text-[#0B1F3B] text-[10px] font-black flex items-center justify-center">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-tight truncate max-w-[74px]">
                {isTa ? tab.labelTa : tab.label}
              </span>
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={onOpenMore}
          data-testid="mobile-more-tab"
          className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] rounded-lg transition-colors ${
            moreOpen ? "text-[#FF6A00] font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {moreOpen && (
            <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-[#FF6A00]" />
          )}
          <Menu className="h-5 w-5" />
          <span className="text-[11px] leading-tight">{isTa ? "அனைத்தும்" : "More"}</span>
        </button>
      </div>
    </nav>
  );
};
