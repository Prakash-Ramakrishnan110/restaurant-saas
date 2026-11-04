import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Layers,
  Users,
  LogOut,
  Globe,
  Sun,
  Moon,
  Smartphone,
  Clock,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

// Simulated live table models for preview
interface TableItem {
  id: string;
  label: string;
  section: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING" | "BLOCKED";
  activeSessionDuration?: string;
}

const INITIAL_TABLES: TableItem[] = [
  { id: "1", label: "T1", section: "Main Dining", capacity: 4, status: "OCCUPIED", activeSessionDuration: "35m" },
  { id: "2", label: "T2", section: "Main Dining", capacity: 2, status: "AVAILABLE" },
  { id: "3", label: "T3", section: "Main Dining", capacity: 4, status: "AVAILABLE" },
  { id: "4", label: "T4", section: "Main Dining", capacity: 6, status: "RESERVED" },
  { id: "5", label: "B1", section: "AC Family Booths", capacity: 6, status: "OCCUPIED", activeSessionDuration: "1h 10m" },
  { id: "6", label: "B2", section: "AC Family Booths", capacity: 6, status: "CLEANING" },
  { id: "7", label: "O1", section: "Outdoor Patio", capacity: 4, status: "AVAILABLE" },
  { id: "8", label: "O2", section: "Outdoor Patio", capacity: 2, status: "BLOCKED" },
];

export const DashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, activeTenant, memberships, selectTenant, logout } = useAuth();
  const { theme, setTheme, touchMode, setTouchMode } = useTheme();
  const navigate = useNavigate();

  const [tables] = useState<TableItem[]>(INITIAL_TABLES);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");

  const filteredTables = tables.filter((table) => {
    if (activeFilter === "ALL") return true;
    return table.status === activeFilter;
  });

  const counts = {
    AVAILABLE: tables.filter((t) => t.status === "AVAILABLE").length,
    OCCUPIED: tables.filter((t) => t.status === "OCCUPIED").length,
    RESERVED: tables.filter((t) => t.status === "RESERVED").length,
    CLEANING: tables.filter((t) => t.status === "CLEANING").length,
    BLOCKED: tables.filter((t) => t.status === "BLOCKED").length,
  };

  const handleLanguageToggle = () => {
    const nextLang = i18n.language.startsWith("ta") ? "en" : "ta";
    i18n.changeLanguage(nextLang);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Top Application Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <BrandLogo size={34} theme={theme === "dark" ? "dark" : "light"} />

          {/* Tenant & Branch Selector */}
          {memberships.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 border-l pl-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("common.branch")}:
              </span>
              <select
                className="text-xs font-semibold bg-background border rounded px-2 py-1 focus:ring-1 focus:ring-[#FF6A00]"
                value={activeTenant?.tenant_id || ""}
                onChange={(e) => selectTenant(e.target.value)}
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

        {/* Right header controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Touch Mode Preset Toggle */}
          <button
            type="button"
            onClick={() => setTouchMode(!touchMode)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              touchMode
                ? "bg-[#FFF3E0] dark:bg-[#0B1F3B] text-[#C2410C] dark:text-[#FF6A00] border-[#FF6A00]"
                : "text-muted-foreground hover:bg-muted"
            }`}
            title="Toggle Touch Mode (optimized for tablet/POS 48px touch targets)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t("common.touchMode")}</span>
          </button>

          {/* Language Toggle */}
          <button
            type="button"
            onClick={handleLanguageToggle}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium hover:bg-muted transition-colors"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{i18n.language.startsWith("ta") ? "English" : "தமிழ்"}</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-md border text-xs hover:bg-muted transition-colors"
            title="Toggle Light/Dark Theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* User Profile / Logout */}
          <div className="flex items-center gap-3 pl-2 border-l">
            <div className="hidden lg:flex flex-col text-right leading-tight">
              <span className="text-xs font-bold text-foreground">{user?.full_name || "Alpha Owner"}</span>
              <span className="text-[10px] text-muted-foreground font-semibold">{activeTenant?.role || "OWNER"}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
              title={t("auth.signOut")}
            >
              <LogOut className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">{t("auth.signOut")}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Welcome Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-gradient-to-r from-[#FFF3E0] to-orange-50 dark:from-[#0B1F3B] dark:to-slate-900 border border-orange-200 dark:border-navy-800">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B1F3B] dark:text-white font-display">
                {activeTenant?.tenant_name || "Alpha Dining"}
              </h1>
              <Badge variant="outline" className="border-[#FF6A00] text-[#C2410C] dark:text-[#FF6A00] font-semibold text-[10px]">
                PRO PLAN
              </Badge>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-sans">
              Live floor and table session overview • Indiranagar Main Branch
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size={touchMode ? "touch" : "default"}
              onClick={() => alert("Floor editor is enabled for Pro plan tenants.")}
            >
              <Layers className="w-4 h-4 mr-2" />
              <span>{t("nav.floorPlan")}</span>
            </Button>
            <Button
              variant="outline"
              size={touchMode ? "touch" : "default"}
              onClick={() => navigate("/dev/brand")}
            >
              <Sparkles className="w-4 h-4 mr-2 text-[#FF6A00]" />
              <span>{t("nav.devBrand")}</span>
            </Button>
          </div>
        </div>

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="border-l-4 border-l-green-500 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">{t("status.AVAILABLE")}</span>
                <Badge variant="available" className="font-bold">{counts.AVAILABLE}</Badge>
              </div>
              <div className="text-2xl font-extrabold mt-2 font-display text-green-700 dark:text-green-400">
                {counts.AVAILABLE} <span className="text-xs font-normal text-muted-foreground">tables</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">{t("status.OCCUPIED")}</span>
                <Badge variant="occupied" className="font-bold">{counts.OCCUPIED}</Badge>
              </div>
              <div className="text-2xl font-extrabold mt-2 font-display text-blue-700 dark:text-blue-400">
                {counts.OCCUPIED} <span className="text-xs font-normal text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">{t("status.RESERVED")}</span>
                <Badge variant="reserved" className="font-bold">{counts.RESERVED}</Badge>
              </div>
              <div className="text-2xl font-extrabold mt-2 font-display text-purple-700 dark:text-purple-400">
                {counts.RESERVED} <span className="text-xs font-normal text-muted-foreground">booked</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">{t("status.CLEANING")}</span>
                <Badge variant="cleaning" className="font-bold">{counts.CLEANING}</Badge>
              </div>
              <div className="text-2xl font-extrabold mt-2 font-display text-amber-700 dark:text-amber-400">
                {counts.CLEANING} <span className="text-xs font-normal text-muted-foreground">in progress</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-gray-500 shadow-sm col-span-2 lg:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">{t("status.BLOCKED")}</span>
                <Badge variant="blocked" className="font-bold">{counts.BLOCKED}</Badge>
              </div>
              <div className="text-2xl font-extrabold mt-2 font-display text-gray-700 dark:text-gray-400">
                {counts.BLOCKED} <span className="text-xs font-normal text-muted-foreground">offline</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Floor Status Section */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold font-display">{t("nav.tables")}</CardTitle>
              <CardDescription>Real-time visual table grid with instant status indicators</CardDescription>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", "AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING", "BLOCKED"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${
                    activeFilter === filter
                      ? "bg-[#FF6A00] text-[#0B1F3B] shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {filter === "ALL" ? "All (8)" : `${t(`status.${filter}`)} (${(counts as any)[filter]})`}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent>
            {filteredTables.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No tables currently in {activeFilter.toLowerCase()} state.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredTables.map((table) => {
                  const badgeVariant = table.status.toLowerCase() as
                    | "available"
                    | "occupied"
                    | "reserved"
                    | "cleaning"
                    | "blocked";

                  return (
                    <div
                      key={table.id}
                      className={`p-4 rounded-xl border bg-card hover:shadow-md transition-shadow relative flex flex-col justify-between ${
                        table.status === "OCCUPIED" ? "border-blue-300 dark:border-blue-900" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-lg font-bold font-display text-foreground">{table.label}</div>
                          <div className="text-xs text-muted-foreground">{table.section}</div>
                        </div>
                        <Badge variant={badgeVariant}>{t(`status.${table.status}`)}</Badge>
                      </div>

                      <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>{table.capacity} seats</span>
                        </div>
                        {table.activeSessionDuration && (
                          <div className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                            <Clock className="w-3 h-3" />
                            <span>{table.activeSessionDuration}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
