import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Bed, Utensils, Layers, LayoutGrid, Zap, Tent } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { TablesPage } from "./TablesPage";
import { RoomsPage } from "./RoomsPage";
import { AreasPage } from "./AreasPage";
import { FloorPlanPage } from "./FloorPlanPage";
import { CountersPage } from "./CountersPage";

interface LayoutTab {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface BusinessResponse {
  business_type?: string;
  venue_profile?: string;
  allows_room_service?: boolean;
  business_settings?: {
    allows_room_service?: boolean;
  };
}

export const VenueLayoutHubPage: React.FC = () => {
  const { activeTenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [businessInfo, setBusinessInfo] = useState<{
    business_type?: string;
    venue_profile?: string;
    allows_room_service?: boolean;
    uses_tables?: boolean;
  }>({});

  useEffect(() => {
    apiClient
      .get<BusinessResponse>("/business/")
      .then((res) => {
        const bType = res.data?.business_type;
        const vProf = res.data?.venue_profile;
        const roomSvc =
          res.data?.allows_room_service ??
          res.data?.business_settings?.allows_room_service ??
          (bType === "HOTEL" || vProf === "HOTEL_RESTAURANT");
        setBusinessInfo({
          business_type: bType,
          venue_profile: vProf,
          allows_room_service: Boolean(roomSvc),
          uses_tables:
            bType !== "TEA_SHOP" &&
            bType !== "QUICK_SERVICE" &&
            vProf !== "QUICK_SERVICE",
        });
      })
      .catch(() => {});
  }, [activeTenant]);

  const businessType =
    businessInfo.business_type || activeTenant?.business_type || "";
  const venueProfile =
    businessInfo.venue_profile || activeTenant?.venue_profile || "";
  const usesTables =
    businessInfo.uses_tables ?? activeTenant?.uses_tables ?? true;

  const isHotel =
    businessType === "HOTEL" ||
    venueProfile === "HOTEL_RESTAURANT" ||
    businessInfo.allows_room_service === true ||
    activeTenant?.allows_room_service === true;

  const isDhaba = businessType === "DHABA";

  const isQuickService =
    !usesTables ||
    businessType === "TEA_SHOP" ||
    businessType === "BAKERY" ||
    businessType === "FOOD_COURT" ||
    businessType === "QUICK_SERVICE" ||
    venueProfile === "QUICK_SERVICE";

  // Build adaptive tabs
  const tabs: LayoutTab[] = useMemo(() => {
    if (isQuickService) {
      return [
        {
          id: "counters",
          label: "Counters & Tokens",
          description: "Fast-casual service counters, pickup windows, and digital tokens",
          icon: Zap,
        },
        {
          id: "areas",
          label: "Service Areas",
          description: "Kitchen, pickup counters, and takeaway staging zones",
          icon: Layers,
        },
      ];
    }

    if (isHotel) {
      return [
        {
          id: "rooms",
          label: "Hotel Rooms",
          description: "Lodging rooms, suites, and in-room dining folios",
          icon: Bed,
        },
        {
          id: "tables",
          label: "Dining Tables",
          description: "Ground-floor restaurant, rooftop lounge, and banquet tables",
          icon: Utensils,
        },
        {
          id: "areas",
          label: "Service Areas",
          description: "Floors, wings, pool deck, and banquet zones",
          icon: Layers,
        },
        {
          id: "floor",
          label: "Floor Plan",
          description: "2D spatial visual layout editor for dining tables",
          icon: LayoutGrid,
        },
      ];
    }

    if (isDhaba) {
      return [
        {
          id: "tables",
          label: "Huts & Tables",
          description: "Private outdoor family huts, cabanas, and lawn charpai tables",
          icon: Tent,
        },
        {
          id: "areas",
          label: "Outdoor Areas",
          description: "Main lawn, family garden, and highway front zones",
          icon: Layers,
        },
        {
          id: "floor",
          label: "Outdoor Floor Plan",
          description: "Spatial visual layout of huts, gazebos, and lawn tables",
          icon: LayoutGrid,
        },
      ];
    }

    // Default Restaurant & Café
    return [
      {
        id: "tables",
        label: "Dining Tables",
        description: "Dine-in tables, seat capacities, and live table status",
        icon: Utensils,
      },
      {
        id: "areas",
        label: "Service Areas",
        description: "AC hall, non-AC dining, rooftop, and outdoor patio",
        icon: Layers,
      },
      {
        id: "floor",
        label: "Floor Plan",
        description: "2D spatial drag-and-drop table layout editor",
        icon: LayoutGrid,
      },
    ];
  }, [isHotel, isDhaba, isQuickService]);

  // Determine active tab
  const rawTab = searchParams.get("tab") || "";
  const activeTabId = tabs.some((t) => t.id === rawTab) ? rawTab : tabs[0]?.id || "tables";

  const handleSelectTab = (tabId: string) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  return (
    <div className="space-y-4">
      {/* Top Unified Hub Subnavigation Bar */}
      <div className="bg-card border border-border rounded-xl p-1.5 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-h-[40px] ${
                  isActive
                    ? "bg-[#FF6A00] text-[#0B1F3B] shadow-sm font-black"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                aria-label={`Switch to ${tab.label}`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#0B1F3B]" : "text-muted-foreground"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Renderer */}
      <div className="pt-1">
        {activeTabId === "rooms" && <RoomsPage />}
        {activeTabId === "tables" && <TablesPage />}
        {activeTabId === "areas" && <AreasPage />}
        {activeTabId === "floor" && <FloorPlanPage />}
        {activeTabId === "counters" && <CountersPage />}
      </div>
    </div>
  );
};
