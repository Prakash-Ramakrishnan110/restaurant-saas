import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { BrandLogo } from "../brand/BrandLogo";
import { Button } from "../ui/button";
import { OfflineBanner } from "../app/OfflineBanner";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { apiClient } from "../../api/client";
import { ordersApi } from "../../api/orders";
import { getNavigationGroups, NavItem } from "../../app/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, memberships, activeTenant, selectTenant, logout, can } = useAuth();
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

  const [venueProfile, setVenueProfile] = useState<string>("");
  const [businessType, setBusinessType] = useState<string>("");
  const [usesTables, setUsesTables] = useState<boolean>(() => {
    const tenant: any = activeTenant;
    if (!tenant) return true;
    if (
      tenant.uses_tables === false ||
      tenant.business_type === "TEA_SHOP" ||
      tenant.venue_profile === "QUICK_SERVICE"
    ) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    const tenant: any = activeTenant;
    if (!tenant) return;
    if (
      tenant.uses_tables === false ||
      tenant.business_type === "TEA_SHOP" ||
      tenant.venue_profile === "QUICK_SERVICE"
    ) {
      setUsesTables(false);
    }
    apiClient
      .get<any>("/business/")
      .then((res) => {
        const bType = res.data?.business_type;
        const vProf = res.data?.venue_profile;
        setBusinessType(bType || "");
        setVenueProfile(vProf || "");
        if (bType === "TEA_SHOP" || vProf === "QUICK_SERVICE") {
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
        const raw = (res.data as any)?.results || res.data || [];
        const orders = Array.isArray(raw) ? raw : [];
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
      can,
    });
  }, [activeTenant, user, businessType, venueProfile, usesTables, can]);

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
    navigate("/login");
  };

  const toggleLanguage = () => {
    const next = i18n.language.startsWith("ta") ? "en" : "ta";
    i18n.changeLanguage(next);
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden flex flex-col font-sans bg-background">
      <OfflineBanner />

      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-card/95 backdrop-blur px-4 sm:px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-md hover:bg-muted text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle navigation menu"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link to="/dashboard" className="flex items-center">
            <BrandLogo size={32} theme={theme === "dark" ? "dark" : "auto"} />
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
        <div className="flex items-center gap-2 sm:gap-3">
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
            className="text-xs font-semibold min-h-[36px]"
            aria-label="Switch language"
          >
            <Globe className="h-3.5 w-3.5 mr-1" />
            {i18n.language.startsWith("ta") ? "தமிழ்" : "EN"}
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

          {/* User & Sign Out */}
          <div className="flex items-center gap-2 border-l border-border pl-2 sm:pl-3">
            <span className="hidden lg:inline text-xs font-medium text-foreground">
              {user?.full_name}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-xs min-h-[36px]"
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

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border flex items-center justify-around py-1.5 px-2 backdrop-blur shadow-lg"
      >
        <Link
          to="/dashboard"
          className={`flex flex-col items-center gap-1 p-1 rounded-md text-[11px] font-semibold min-h-[48px] min-w-[56px] justify-center ${
            location.pathname === "/dashboard" ? "text-[#FF6A00]" : "text-muted-foreground"
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Home</span>
        </Link>

        {/* Orders link */}
        <Link
          to="/pos"
          className={`flex flex-col items-center gap-1 p-1 rounded-md text-[11px] font-semibold min-h-[48px] min-w-[56px] justify-center ${
            location.pathname.startsWith("/pos") ? "text-[#FF6A00]" : "text-muted-foreground"
          }`}
        >
          <Utensils className="h-5 w-5" />
          <span>{usesTables ? "Tables" : "Counters"}</span>
        </Link>

        {/* Kitchen KDS link */}
        <Link
          to="/kds"
          className={`flex flex-col items-center gap-1 p-1 rounded-md text-[11px] font-semibold min-h-[48px] min-w-[56px] justify-center ${
            location.pathname.startsWith("/kds") ? "text-[#FF6A00]" : "text-muted-foreground"
          }`}
        >
          <ChefHat className="h-5 w-5" />
          <span>KDS</span>
        </Link>

        {/* Billing link */}
        <Link
          to="/billing"
          className={`flex flex-col items-center gap-1 p-1 rounded-md text-[11px] font-semibold min-h-[48px] min-w-[56px] justify-center ${
            location.pathname.startsWith("/billing") ? "text-[#FF6A00]" : "text-muted-foreground"
          }`}
        >
          <Receipt className="h-5 w-5" />
          <span>Billing</span>
        </Link>

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
