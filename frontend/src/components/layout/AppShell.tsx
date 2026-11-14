import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LogOut,
  Sun,
  Moon,
  Globe,
  Wifi,
  WifiOff,
  Menu,
  X,
  Search,
  LayoutDashboard,
  Utensils,
  Receipt,
  ChefHat,
  LifeBuoy,
  Megaphone,
  CheckCircle2,
  Clock,
  RefreshCw,
  Volume2,
  VolumeX,
  Users,
  ShieldCheck,
  FileText,
  BarChart2,
  UtensilsCrossed,
  Activity,
} from "lucide-react";
import { isSoundEnabled, setSoundEnabled, testSoundAlert } from "../../utils/soundAlerts";
import { BrandLogo } from "../brand/BrandLogo";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { OfflineBanner } from "../app/OfflineBanner";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { apiClient } from "../../api/client";
import { ordersApi, Order } from "../../api/orders";
import { unwrapList, ListResponse } from "../../api/pagination";
import { getNavigationGroups, NavItem } from "../../app/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, memberships, activeTenant, activeRole, selectTenant, logout, can } = useAuth();
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) {
      testSoundAlert();
    }
  };

  const [activeOrdersCount, setActiveOrdersCount] = useState<number>(0);
  const [readyOrdersCount, setReadyOrdersCount] = useState<number>(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const [venueProfile, setVenueProfile] = useState<string>(
    () => (activeTenant as any)?.venue_profile || ""
  );
  const [businessType, setBusinessType] = useState<string>(
    () => (activeTenant as any)?.business_type || ""
  );
  const [allowsRoomService, setAllowsRoomService] = useState<boolean>(false);
  const [usesTables, setUsesTables] = useState<boolean>(() => {
    const tenant: any = activeTenant;
    if (!tenant) return true;
    if (
      tenant.uses_tables === false ||
      tenant.business_type === "TEA_SHOP" ||
      tenant.business_type === "BAKERY" ||
      tenant.business_type === "FOOD_COURT" ||
      tenant.business_type === "FOOD_TRUCK_COURT" ||
      tenant.business_type === "QUICK_SERVICE" ||
      tenant.venue_profile === "QUICK_SERVICE"
    ) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    const tenant: any = activeTenant;
    if (!tenant) return;
    if (tenant.business_type) {
      setBusinessType(tenant.business_type);
      if (
        tenant.business_type === "TEA_SHOP" ||
        tenant.business_type === "BAKERY" ||
        tenant.business_type === "FOOD_COURT" ||
        tenant.business_type === "FOOD_TRUCK_COURT" ||
        tenant.business_type === "QUICK_SERVICE" ||
        tenant.venue_profile === "QUICK_SERVICE" ||
        tenant.uses_tables === false
      ) {
        setUsesTables(false);
      }
    }
    if (tenant.venue_profile) {
      setVenueProfile(tenant.venue_profile);
    }
    if (
      tenant.uses_tables === false ||
      tenant.business_type === "TEA_SHOP" ||
      tenant.business_type === "QUICK_SERVICE" ||
      tenant.venue_profile === "QUICK_SERVICE"
    ) {
      setUsesTables(false);
    }
    apiClient
      .get<any>("/business/")
      .then((res) => {
        const bType = res.data?.business_type;
        const vProf = res.data?.venue_profile;
        const roomSvc =
          res.data?.allows_room_service ??
          res.data?.business_settings?.allows_room_service ??
          (bType === "HOTEL" || vProf === "HOTEL_RESTAURANT");
        setBusinessType(bType || "");
        setVenueProfile(vProf || "");
        setAllowsRoomService(!!roomSvc);
        if (
          bType === "TEA_SHOP" ||
          bType === "BAKERY" ||
          bType === "FOOD_COURT" ||
          bType === "FOOD_TRUCK_COURT" ||
          bType === "QUICK_SERVICE" ||
          vProf === "QUICK_SERVICE"
        ) {
          setUsesTables(false);
        } else {
          setUsesTables(true);
        }
      })
      .catch(() => {});
  }, [activeTenant]);

  // Live order counts polling for badges
  useEffect(() => {
    if (user?.is_platform_admin) return;

    const pollCounts = async () => {
      try {
        const res = await ordersApi.getOrders();
        const orders = unwrapList<Order>(res.data);
        const active = orders.filter((o) => o.status === "NEW" || o.status === "PREPARING").length;
        const ready = orders.filter((o) => o.status === "READY").length;
        setActiveOrdersCount(active);
        setReadyOrdersCount(ready);
      } catch {
        // Silently skip if network or endpoint fails
      }
    };

    pollCounts();
    const timer = setInterval(pollCounts, 15000);
    return () => clearInterval(timer);
  }, [user]);

  // Platform Announcements for Tenant Dashboards
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);

  // Support Desk Ticket Dialog for Tenants
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportTab, setSupportTab] = useState<"history" | "new">("history");
  const [tenantTickets, setTenantTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportDescription, setSupportDescription] = useState("");
  const [supportPriority, setSupportPriority] = useState("MEDIUM");
  const [supportPhone, setSupportPhone] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState<string | null>(null);

  const fetchTenantTickets = useCallback(async () => {
    if (user?.is_platform_admin) return;
    setLoadingTickets(true);
    try {
      const res = await apiClient.get<ListResponse<any>>("/support-tickets/");
      const list = unwrapList(res.data);
      setTenantTickets(list);
    } catch {
      // Handled
    } finally {
      setLoadingTickets(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user?.is_platform_admin) {
      fetchTenantTickets();
    }
  }, [user, fetchTenantTickets]);

  useEffect(() => {
    if (supportOpen && !user?.is_platform_admin) {
      fetchTenantTickets();
    }
  }, [supportOpen, user, fetchTenantTickets]);

  useEffect(() => {
    if (user?.is_platform_admin) return;

    apiClient
      .get<ListResponse<any> | any[]>("/announcements/")
      .then((res) => {
        setAnnouncements(unwrapList(res.data));
      })
      .catch(() => {});
  }, [user]);

  const activeAnnouncements = useMemo(() => {
    if (user?.is_platform_admin) return [];
    return announcements.filter((a) => {
      if (!a.is_active || dismissedAnnouncements.includes(a.id)) return false;
      if (!a.target_business_type || a.target_business_type === "ALL") return true;
      return a.target_business_type === businessType;
    });
  }, [announcements, dismissedAnnouncements, businessType, user]);

  const handleCreateSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportDescription.trim()) return;

    setSupportSubmitting(true);
    setSupportSuccess(null);
    try {
      await apiClient.post("/support-tickets/", {
        subject: supportSubject.trim(),
        description: supportDescription.trim(),
        priority: supportPriority,
        contact_phone: supportPhone.trim(),
        contact_email: user?.email || "",
      });
      setSupportSuccess("Ticket submitted successfully! Platform support will respond shortly.");
      setSupportSubject("");
      setSupportDescription("");
      fetchTenantTickets();
      setTimeout(() => {
        setSupportSuccess(null);
        setSupportTab("history");
      }, 1500);
    } catch {
      // Handled
    } finally {
      setSupportSubmitting(false);
    }
  };

  // Command palette keyboard shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Compute navigation groups using navigation.ts
  const navGroups = useMemo(() => {
    return getNavigationGroups({
      role: activeTenant?.role,
      isPlatformAdmin: user?.is_platform_admin,
      businessType,
      venueProfile,
      usesTables,
      allowsRoomService,
      can,
    });
  }, [activeTenant, user, businessType, venueProfile, usesTables, allowsRoomService, can]);

  // Flattened items for command palette search
  const flatNavItems = useMemo(() => {
    const items: NavItem[] = [];
    navGroups.forEach((grp) => {
      grp.items.forEach((item) => {
        items.push(item);
      });
    });
    return items;
  }, [navGroups]);

  // Mobile role-adaptive bottom bar items matching docs/product/sidebar-map.md
  const bottomBarItems = useMemo(() => {
    if (user?.is_platform_admin) {
      return [
        { label: "Home", path: "/admin", icon: ShieldCheck },
        { label: "Customers", path: "/admin/tenants", icon: Users },
      ];
    }
    const role = activeTenant?.role || activeRole;
    if (role === "KITCHEN") {
      return [
        { label: "Kitchen", path: "/kds", icon: ChefHat },
        { label: "Availability", path: "/menu/availability", icon: Clock },
      ];
    }
    if (role === "WAITER") {
      return [
        { label: usesTables ? "Tables" : "Counters", path: "/pos", icon: Utensils },
        { label: "Ready", path: "/serve", icon: CheckCircle2 },
        { label: "Orders", path: "/orders", icon: Activity },
      ];
    }
    if (role === "CASHIER") {
      return [
        { label: "Billing", path: "/billing", icon: Receipt },
        { label: "Orders", path: "/orders", icon: Activity },
        { label: "Availability", path: "/menu/availability", icon: Clock },
        { label: "Bills", path: "/billing/bills", icon: FileText },
      ];
    }
    // Owner, Manager, or Default
    return [
      { label: "Home", path: "/dashboard", icon: LayoutDashboard },
      { label: "Orders", path: "/orders", icon: Activity },
      { label: "Menu", path: "/menu", icon: UtensilsCrossed },
      { label: "Reports", path: "/reports/today", icon: BarChart2 },
    ];
  }, [user?.is_platform_admin, activeTenant?.role, activeRole, usesTables]);

  const filteredPaletteItems = useMemo(() => {
    if (!searchQuery.trim()) return flatNavItems;
    const q = searchQuery.toLowerCase();
    return flatNavItems.filter((it) => it.label.toLowerCase().includes(q));
  }, [flatNavItems, searchQuery]);

  const handleSelectPaletteItem = (path: string) => {
    setPaletteOpen(false);
    setSearchQuery("");
    navigate(path);
  };

  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredPaletteItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredPaletteItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredPaletteItems[selectedIndex]) {
        handleSelectPaletteItem(filteredPaletteItems[selectedIndex].path);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true, state: null });
  };

  const toggleLanguage = () => {
    const next = i18n.language.startsWith("ta") ? "en" : "ta";
    i18n.changeLanguage(next);
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden flex flex-col font-sans bg-background">
      <OfflineBanner />

      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-card/95 backdrop-blur px-2 sm:px-6 py-2 flex items-center justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-1.5 rounded-md hover:bg-muted text-foreground min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
            aria-label="Toggle navigation menu"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link
            to={user?.is_platform_admin ? "/admin" : "/dashboard"}
            className="flex items-center shrink-0"
          >
            <BrandLogo size={28} theme={theme === "dark" ? "dark" : "auto"} />
          </Link>

          {/* Quick Command Palette Button */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1 text-xs text-muted-foreground bg-muted/60 hover:bg-muted border border-border rounded-md min-h-[36px]"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search or jump to...</span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded text-muted-foreground">
              Ctrl K
            </kbd>
          </button>

          {/* Branch Switcher */}
          {memberships.length > 0 && !user?.is_platform_admin && (
            <div className="hidden sm:flex items-center gap-2 border-l border-border pl-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Restaurant:
              </span>
              <select
                aria-label="Select active restaurant"
                value={activeTenant?.tenant_id || ""}
                onChange={(e) => selectTenant(e.target.value)}
                className="text-xs font-semibold bg-background border border-input rounded-md px-2 py-1.5 focus:ring-2 focus:ring-[#FF6A00] outline-none min-h-[36px]"
              >
                {memberships.map((m) => (
                  <option key={m.tenant_id} value={m.tenant_id}>
                    {m.tenant_name} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Status Pills & Controls */}
        <div className="flex items-center gap-0.5 sm:gap-3 shrink-0">
          {/* Connection Status Indicator */}
          <div
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isOnline
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 animate-pulse"
            }`}
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span>{isOnline ? "Online" : "Offline"}</span>
          </div>

          {/* Language Switcher */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="text-xs font-semibold min-h-[36px] px-1.5 sm:px-2.5"
            aria-label="Switch language"
          >
            <Globe className="h-3.5 w-3.5 sm:mr-1" />
            <span className="ml-0.5">{i18n.language.startsWith("ta") ? "தமிழ்" : "EN"}</span>
          </Button>

          {/* Sound Alerts Switcher */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleSound}
            className={`min-h-[36px] min-w-[36px] p-2 ${soundOn ? "text-[#FF6A00]" : "text-muted-foreground"}`}
            aria-label={soundOn ? "Mute order sound alerts" : "Enable order sound alerts"}
            title={
              soundOn
                ? "Order sound alerts active (click to mute)"
                : "Order sound alerts muted (click to enable)"
            }
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          {/* Theme Switcher */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="min-h-[36px] min-w-[36px] p-2"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Tenant Support Desk Button */}
          {!user?.is_platform_admin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSupportOpen(true);
                setSupportTab(tenantTickets.length > 0 ? "history" : "new");
              }}
              className="hidden sm:inline-flex text-xs font-semibold min-h-[36px] gap-1.5 border-border hover:border-[#FF6A00] relative"
              aria-label="Open support desk"
            >
              <LifeBuoy className="h-3.5 w-3.5 text-[#FF6A00]" />
              <span className="hidden md:inline">Support</span>
              {tenantTickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS")
                .length > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6A00] text-[#0B1F3B]">
                  {
                    tenantTickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS")
                      .length
                  }
                </span>
              )}
            </Button>
          )}

          {/* User & Sign Out */}
          <div className="flex items-center gap-1 sm:gap-2 border-l border-border pl-1 sm:pl-3">
            <span className="hidden lg:inline text-xs font-medium text-foreground">
              {user?.full_name}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-xs min-h-[36px] px-2 sm:px-3"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container with Independent Scrolling */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar with Independent Scrolling */}
        <aside
          className={`md:flex flex-col w-64 border-r border-border bg-card shrink-0 transition-all overflow-hidden ${
            sidebarOpen ? "fixed inset-y-0 left-0 z-40 flex shadow-2xl mt-[57px]" : "hidden"
          }`}
        >
          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
            <nav className="space-y-4" aria-label="Main Navigation">
              {navGroups.map((group) => (
                <div key={group.label} className="space-y-1">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-3 mb-1 block select-none">
                    {group.label}
                  </span>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    const badgeCount =
                      item.badgeKey === "activeOrders"
                        ? activeOrdersCount
                        : item.badgeKey === "readyOrders"
                          ? readyOrdersCount
                          : 0;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                          isActive
                            ? "bg-[#FF6A00] text-[#0B1F3B] font-bold shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {badgeCount > 0 && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? "bg-[#0B1F3B] text-white"
                                : item.badgeKey === "readyOrders"
                                  ? "bg-emerald-500 text-white animate-pulse"
                                  : "bg-[#FF6A00] text-[#0B1F3B]"
                            }`}
                          >
                            {badgeCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>

          {/* Active Tenant Card in Sidebar Footer */}
          <div className="p-3 border-t border-border bg-muted/30 shrink-0">
            <div className="text-xs font-semibold text-foreground truncate">
              {user?.is_platform_admin
                ? "ServeMyFood Platform Console"
                : activeTenant?.tenant_name || "ServeMyFood"}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between mt-0.5">
              <span>
                Role: {user?.is_platform_admin ? "Super Admin" : activeTenant?.role || "Staff"}
              </span>
              <span className="text-[#C2410C] font-semibold">Active</span>
            </div>
            <div className="text-[10px] text-muted-foreground/75 mt-1 font-mono">
              ServeMyFood {typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "v0.8.0"}
            </div>
          </div>
        </aside>

        {/* Main Content View with Independent Scrolling & Overscroll Contain */}
        <main
          id="main-scroll"
          className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full"
        >
          {/* Active Platform Announcements Banner for Tenant Dashboards */}
          {activeAnnouncements.length > 0 && (
            <div className="mb-4 space-y-2">
              {activeAnnouncements.map((a) => {
                const isCritical = a.announcement_type === "CRITICAL";
                const isWarning = a.announcement_type === "WARNING";
                const isMaint = a.announcement_type === "MAINTENANCE";

                const bannerBorderBg = isCritical
                  ? "border-red-300 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/40"
                  : isWarning
                    ? "border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40"
                    : isMaint
                      ? "border-purple-300 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40"
                      : "border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40";

                const iconColor = isCritical
                  ? "text-red-600 dark:text-red-400"
                  : isWarning
                    ? "text-amber-600 dark:text-amber-400"
                    : isMaint
                      ? "text-purple-600 dark:text-purple-400"
                      : "text-blue-600 dark:text-blue-400";

                const typeBadgeColor = isCritical
                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300"
                  : isWarning
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300"
                    : isMaint
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300";

                return (
                  <div
                    key={a.id}
                    className={`p-3.5 rounded-xl border ${bannerBorderBg} text-xs flex items-start justify-between gap-3 shadow-xs animate-in slide-in-from-top-1`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Megaphone className={`h-4 w-4 ${iconColor} mt-0.5 shrink-0`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-foreground">{a.title}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${typeBadgeColor}`}
                          >
                            {a.announcement_type || "ANNOUNCEMENT"}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1 leading-relaxed">{a.message}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDismissedAnnouncements((prev) => [...prev, a.id])}
                      className="p-1 text-muted-foreground hover:text-foreground rounded-md shrink-0 transition-colors"
                      title="Dismiss announcement"
                      aria-label="Dismiss announcement"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Command Palette Dialog (Ctrl+K) */}
      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-border shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Quick Navigation</DialogTitle>
          </DialogHeader>
          <div className="p-3 border-b border-border flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Jump to page... (or use arrow keys)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handlePaletteKeyDown}
              className="w-full text-xs bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground min-h-[32px]"
            />
            <kbd className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">
              ESC
            </kbd>
          </div>

          <div className="max-h-64 overflow-y-auto p-2 space-y-1">
            {filteredPaletteItems.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No matching pages found.
              </div>
            ) : (
              filteredPaletteItems.map((item, index) => {
                const Icon = item.icon;
                const isSel = index === selectedIndex;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => handleSelectPaletteItem(item.path)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center justify-between p-2 rounded-md text-xs font-medium transition-colors text-left ${
                      isSel
                        ? "bg-[#FF6A00] text-[#0B1F3B] font-bold"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-70">{item.path}</span>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tenant Helpdesk Support Ticket Dialog */}
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="sm:max-w-xl font-sans max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pr-8">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-[#FF6A00]" />
              <DialogTitle className="text-base font-bold text-foreground">
                Restaurant Support Helpdesk
              </DialogTitle>
            </div>
          </DialogHeader>

          {/* Tab Bar with Refresh Action */}
          <div className="flex items-center justify-between border-b border-border mt-1">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setSupportTab("history")}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  supportTab === "history"
                    ? "border-[#FF6A00] text-[#FF6A00]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>My Tickets</span>
                {tenantTickets.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                    {tenantTickets.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSupportTab("new")}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors ${
                  supportTab === "new"
                    ? "border-[#FF6A00] text-[#FF6A00]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                + Raise New Ticket
              </button>
            </div>

            {supportTab === "history" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchTenantTickets}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 pb-2"
                title="Refresh tickets"
              >
                <RefreshCw className={`h-3 w-3 ${loadingTickets ? "animate-spin" : ""}`} />
                <span className="text-[11px] hidden sm:inline">Refresh</span>
              </Button>
            )}
          </div>

          {supportTab === "history" ? (
            <div className="space-y-3 pt-2">
              {loadingTickets && tenantTickets.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-[#FF6A00]" />
                  Loading your support tickets...
                </div>
              ) : tenantTickets.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <LifeBuoy className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">
                    You have not raised any support requests yet.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setSupportTab("new")}
                    className="text-xs bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-[#0B1F3B]"
                  >
                    Raise Your First Ticket
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  {tenantTickets.map((t) => {
                    const statusColor =
                      t.status === "RESOLVED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                        : t.status === "IN_PROGRESS"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                          : t.status === "CLOSED"
                            ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800";

                    const priorityColor =
                      t.priority === "URGENT"
                        ? "text-red-600 dark:text-red-400 font-bold"
                        : t.priority === "HIGH"
                          ? "text-orange-600 dark:text-orange-400 font-semibold"
                          : "text-muted-foreground";

                    return (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-lg border border-border bg-card shadow-xs space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-extrabold text-sm text-foreground">{t.subject}</h4>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                              <span>
                                Priority: <strong className={priorityColor}>{t.priority}</strong>
                              </span>
                              <span>•</span>
                              <span>{new Date(t.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold uppercase ${statusColor}`}
                          >
                            {t.status.replace("_", " ")}
                          </Badge>
                        </div>

                        <p className="text-muted-foreground text-xs leading-relaxed bg-muted/30 p-2 rounded">
                          {t.description}
                        </p>

                        {/* Admin Resolution Notes */}
                        {t.admin_notes && (
                          <div className="p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 space-y-1">
                            <span className="font-bold text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Platform
                              Support Response:
                            </span>
                            <p className="text-xs text-foreground font-medium pl-4">
                              {t.admin_notes}
                            </p>
                          </div>
                        )}

                        {t.resolved_at && (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Resolved on{" "}
                            {new Date(t.resolved_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : supportSuccess ? (
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 my-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{supportSuccess}</span>
            </div>
          ) : (
            <form onSubmit={handleCreateSupportTicket} className="space-y-3.5 pt-2">
              <p className="text-xs text-muted-foreground">
                Submit an urgent ticket or inquiry directly to the ServeMyFood platform operations
                team.
              </p>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Subject / Issue Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Printer not printing KOT receipts"
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Priority Level
                  </label>
                  <select
                    value={supportPriority}
                    onChange={(e) => setSupportPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                  >
                    <option value="LOW">Low - General Question</option>
                    <option value="MEDIUM">Medium - Normal Issue</option>
                    <option value="HIGH">High - Service Affected</option>
                    <option value="URGENT">Urgent - Billing / Outage</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Callback Mobile No.
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Detailed Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe what occurred, table/order numbers, or device details..."
                  value={supportDescription}
                  onChange={(e) => setSupportDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSupportOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={supportSubmitting}
                  className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-[#0B1F3B] font-bold text-xs"
                >
                  {supportSubmitting ? "Submitting..." : "Submit Support Ticket"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Tab Bar (Role-Adaptive per docs/product/sidebar-map.md) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border flex items-center justify-around py-1.5 px-2 backdrop-blur shadow-lg"
      >
        {bottomBarItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/dashboard" || item.path === "/admin"
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 p-1 rounded-md text-[11px] font-semibold min-h-[48px] min-w-[56px] justify-center ${
                isActive ? "text-[#FF6A00]" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center gap-1 p-1 rounded-md text-[11px] font-semibold text-muted-foreground min-h-[48px] min-w-[56px] justify-center"
        >
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
};
