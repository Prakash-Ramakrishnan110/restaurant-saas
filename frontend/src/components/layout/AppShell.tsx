import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Sparkles,
  GitBranch,
  Layers,
  Utensils,
  LayoutGrid,
  QrCode,
  Users,
  Sliders,
  LogOut,
  Sun,
  Moon,
  Globe,
  Wifi,
  WifiOff,
  Menu,
  X,
  Palette,
  Component,
} from "lucide-react";
import { BrandLogo } from "../brand/BrandLogo";
import { Button } from "../ui/button";
import { OfflineBanner } from "../app/OfflineBanner";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  badge?: string;
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, memberships, activeTenant, selectTenant, logout, can } = useAuth();
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

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

  const navItems: NavItem[] = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Onboarding", path: "/onboarding", icon: Sparkles, permission: "business.manage" },
    { label: "Branches", path: "/branches", icon: GitBranch, permission: "branch.view" },
    { label: "Service Areas", path: "/venue/areas", icon: Layers, permission: "area.view" },
    { label: "Dining Tables", path: "/venue/tables", icon: Utensils, permission: "table.view" },
    { label: "Floor Plan", path: "/venue/floor", icon: LayoutGrid, permission: "floor.manage" },
    { label: "QR Codes", path: "/qr", icon: QrCode, permission: "qr.view" },
    { label: "Staff", path: "/staff", icon: Users, permission: "staff.view" },
    { label: "Settings", path: "/settings/venue", icon: Sliders, permission: "business.manage" },
  ];

  const devItems: NavItem[] = [
    { label: "Brand Showcase", path: "/dev/brand", icon: Palette },
    { label: "Design System", path: "/dev/design-system", icon: Component },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (!item.permission) return true;
    return can(item.permission);
  });

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const toggleLanguage = () => {
    const next = i18n.language.startsWith("ta") ? "en" : "ta";
    i18n.changeLanguage(next);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <OfflineBanner />

      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur px-4 sm:px-6 py-2.5 flex items-center justify-between">
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
            <BrandLogo size={32} theme={theme === "dark" ? "dark" : "light"} />
          </Link>

          {/* Branch Switcher */}
          {memberships.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 border-l border-border pl-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Tenant:</span>
              <select
                aria-label="Select active tenant"
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

      {/* Main Container with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={`md:flex flex-col w-64 border-r border-border bg-card shrink-0 transition-all ${
            sidebarOpen ? "fixed inset-y-0 left-0 z-40 flex shadow-2xl mt-[57px]" : "hidden"
          }`}
        >
          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-3 mb-2 block">
                Restaurant Management
              </span>
              <nav className="space-y-1" aria-label="Main Navigation">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                        isActive
                          ? "bg-[#FF6A00] text-[#0B1F3B] font-bold shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-border">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-3 mb-2 block">
                Dev & Design Tools
              </span>
              <nav className="space-y-1">
                {devItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[38px] ${
                        isActive
                          ? "bg-accent text-accent-foreground font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Active Tenant Card in Sidebar Footer */}
          <div className="p-3 border-t border-border bg-muted/30">
            <div className="text-xs font-semibold text-foreground truncate">
              {activeTenant?.tenant_name || "ServeMyFood"}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between mt-0.5">
              <span>Role: {activeTenant?.role || "Staff"}</span>
              <span className="text-[#C2410C] font-semibold">Active</span>
            </div>
          </div>
        </aside>

        {/* Main Content View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 pb-20 md:pb-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

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
        <Link
          to="/venue/tables"
          className={`flex flex-col items-center gap-1 p-1 rounded-md text-[11px] font-semibold min-h-[48px] min-w-[56px] justify-center ${
            location.pathname.startsWith("/venue/tables")
              ? "text-[#FF6A00]"
              : "text-muted-foreground"
          }`}
        >
          <Utensils className="h-5 w-5" />
          <span>Tables</span>
        </Link>
        <Link
          to="/qr"
          className={`flex flex-col items-center gap-1 p-1 rounded-md text-[11px] font-semibold min-h-[48px] min-w-[56px] justify-center ${
            location.pathname.startsWith("/qr") ? "text-[#FF6A00]" : "text-muted-foreground"
          }`}
        >
          <QrCode className="h-5 w-5" />
          <span>QR</span>
        </Link>
        <Link
          to="/staff"
          className={`flex flex-col items-center gap-1 p-1 rounded-md text-[11px] font-semibold min-h-[48px] min-w-[56px] justify-center ${
            location.pathname.startsWith("/staff") ? "text-[#FF6A00]" : "text-muted-foreground"
          }`}
        >
          <Users className="h-5 w-5" />
          <span>Staff</span>
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
