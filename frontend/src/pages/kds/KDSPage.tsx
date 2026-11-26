import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChefHat, Clock, CheckCircle2, Volume2, VolumeX, Flame, Search } from "lucide-react";
import { ordersApi, KDSTicket } from "../../api/orders";
import { unwrapList } from "../../api/pagination";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { soundEngine } from "../../sound/engine";
import { isSoundEnabled, setSoundEnabled as persistSoundEnabled } from "../../utils/soundAlerts";
import { useLiveSync } from "../../realtime/liveSync";

// Readable ticket age: "7m", "2h 5m", "3d 4h" (raw minutes like 9921m are unreadable)
const formatElapsed = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
};

export const KDSPage: React.FC = () => {
  const { activeTenant } = useAuth();
  const [tickets, setTickets] = useState<KDSTicket[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PLACED" | "PREPARING">("ALL");
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "QR" | "POS">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"OLDEST" | "NEWEST">("OLDEST");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => isSoundEnabled());
  const previousTicketCount = useRef<number>(0);

  const triggerKdsChime = () => {
    if (!soundEnabled) return;
    soundEngine.playTone("new-order");
  };

  const fetchTickets = async () => {
    if (!activeTenant) return;
    try {
      const station = selectedStation === "ALL" ? undefined : selectedStation;
      const res = await ordersApi.getKDSTickets(station);
      const newTickets = unwrapList<KDSTicket>(res.data);

      // Check if new tickets arrived to sound alert
      if (newTickets.length > previousTicketCount.current && previousTicketCount.current > 0) {
        triggerKdsChime();
      }
      previousTicketCount.current = newTickets.length;
      setTickets(newTickets);
    } catch {
      // Silent error on polling
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 3000); // 3-second live auto-sync per ADR 0013
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenant?.tenant_id, selectedStation]);

  useLiveSync(() => {
    void fetchTickets();
  });

  const handleBump = async (ticketId: string) => {
    try {
      await ordersApi.bumpKDSTicket(ticketId);
      await fetchTickets();
    } catch {
      // Handle bump error
    }
  };

  const STATIONS = [
    { id: "ALL", label: "All Stations" },
    { id: "MAIN_KITCHEN", label: "Main Kitchen" },
    { id: "TANDOOR", label: "Tandoor & Grill" },
    { id: "BAR", label: "Bar & Drinks" },
    { id: "CHAI_BAR", label: "Chai & Snacks" },
  ];

  const ticketList = useMemo(() => (Array.isArray(tickets) ? tickets : []), [tickets]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = ticketList.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (sourceFilter === "QR" && t.source !== "QR") return false;
      if (sourceFilter === "POS" && t.source === "QR") return false;
      if (q) {
        const matchesTable = (t.table_label || "").toLowerCase().includes(q);
        const matchesNotes = (t.notes || "").toLowerCase().includes(q);
        const matchesItem = (t.items || []).some((line) =>
          (line.item_name || "").toLowerCase().includes(q)
        );
        if (!matchesTable && !matchesNotes && !matchesItem) return false;
      }
      return true;
    });
    return [...list].sort((a, b) =>
      sortOrder === "OLDEST"
        ? b.elapsed_minutes - a.elapsed_minutes
        : a.elapsed_minutes - b.elapsed_minutes
    );
  }, [ticketList, statusFilter, sourceFilter, searchQuery, sortOrder]);

  const hasActiveFilters =
    statusFilter !== "ALL" || sourceFilter !== "ALL" || searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col gap-4 bg-background font-sans pb-6">
      {/* Clean Solid Header & Compact Filter Bar (non-sticky so cards never scroll behind it) */}
      <div className="rounded-xl border border-border bg-card px-4 py-3.5 space-y-3 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ChefHat className="h-6 w-6 shrink-0 text-[#FF6A00]" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold font-heading text-foreground leading-tight">
                Kitchen Display System (KDS)
              </h1>
              <p className="text-xs text-muted-foreground">
                Live station cards with automatic 3s auto-sync and SLA timers.
              </p>
            </div>
          </div>

          {/* Station Filter & Sound Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 border border-border rounded-lg p-0.5 bg-muted/40 max-w-full">
              {STATIONS.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStation(st.id)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    selectedStation === st.id
                      ? "bg-[#0A192F] text-white dark:bg-white dark:text-black shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSoundEnabled(true);
                persistSoundEnabled(true);
                void soundEngine.unlock();
                triggerKdsChime();
              }}
              className="h-8 px-2.5 text-xs font-semibold gap-1.5"
              data-testid="start-sound-btn"
            >
              <Volume2 className="h-3.5 w-3.5 text-[#FF6A00]" />
              Start Sound
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                persistSoundEnabled(next);
              }}
              className="h-8 w-8 p-0"
              title={soundEnabled ? "Audio alert on" : "Audio muted"}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-[#FF6A00]" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>

            <Badge variant="outline" className="text-xs px-2.5 py-1 font-bold">
              {ticketList.length} Active Tickets
            </Badge>
          </div>
        </div>

        {/* Compact Working Filter Strip */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-border/60">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table or dish..."
              aria-label="Search table or dish"
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/40"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "PLACED" | "PREPARING")}
            aria-label="Filter by status"
            className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/40"
          >
            <option value="ALL">All Status</option>
            <option value="PLACED">Queued</option>
            <option value="PREPARING">Cooking</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as "ALL" | "QR" | "POS")}
            aria-label="Filter by source"
            className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/40"
          >
            <option value="ALL">All Sources</option>
            <option value="QR">QR Orders</option>
            <option value="POS">Staff POS</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "OLDEST" | "NEWEST")}
            aria-label="Sort tickets"
            className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/40"
          >
            <option value="OLDEST">Oldest first (SLA)</option>
            <option value="NEWEST">Newest first</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setStatusFilter("ALL");
                setSourceFilter("ALL");
                setSearchQuery("");
              }}
              className="h-9 px-2.5 rounded-lg text-xs font-semibold text-[#C2410C] dark:text-[#FF6A00] hover:bg-[#FF6A00]/10 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Ticket Cards Grid */}
      {filteredTickets.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center text-center p-12 rounded-xl border border-dashed border-border bg-card/40 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 text-emerald-500/40 mb-3" />
          <h3 className="text-base font-bold text-foreground">
            {hasActiveFilters ? "No matching tickets" : "Kitchen Queue Clear!"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {hasActiveFilters
              ? "Try clearing your status, source, or search filters."
              : "No active tickets in preparation for this station."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {filteredTickets.map((t) => {
            const isLate = t.elapsed_minutes >= 20;
            const isWarning = t.elapsed_minutes >= 10 && t.elapsed_minutes < 20;

            return (
              <div
                key={t.id}
                className={`rounded-xl border border-border border-t-4 flex flex-col justify-between bg-card shadow-sm overflow-hidden ${
                  isLate
                    ? "border-t-destructive"
                    : isWarning
                      ? "border-t-amber-400"
                      : "border-t-emerald-500"
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="px-4 py-3 border-b border-border bg-[#0A192F] text-white flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-heading font-extrabold text-lg">{t.table_label}</span>
                      {t.source === "QR" && (
                        <Badge className="text-xs bg-[#FF6A00] text-[#0B1F3B] font-bold border-none">
                          QR
                        </Badge>
                      )}
                      {(t.notes || "").includes("[PARCEL]") && (
                        <Badge className="text-xs bg-amber-400 text-[#0B1F3B] font-extrabold border-none">
                          PARCEL
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-xs bg-white/15 text-white border-none font-semibold"
                      >
                        {t.status}
                      </Badge>
                    </div>
                    <div
                      className={`inline-flex items-center gap-1.5 text-xs font-bold font-mono px-2.5 py-1 rounded-full shrink-0 ${
                        isLate
                          ? "bg-destructive text-white"
                          : isWarning
                            ? "bg-amber-500 text-white"
                            : "bg-white/15 text-white"
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatElapsed(t.elapsed_minutes)}</span>
                    </div>
                  </div>

                  {/* Ticket Order Notes */}
                  {t.notes && (
                    <div className="bg-amber-100/90 dark:bg-amber-950/40 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 font-semibold border-b border-amber-200 dark:border-amber-800/50">
                      ⚠️ {t.notes}
                    </div>
                  )}

                  {/* Line Items */}
                  <div className="p-4 space-y-2">
                    {(t.items || []).map((line) => (
                      <div
                        key={line.id}
                        className="flex flex-col py-1 border-b border-border/40 last:border-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-extrabold text-base text-[#FF6A00] min-w-[28px]">
                              {line.quantity}×
                            </span>
                            <span className="font-semibold text-sm text-foreground">
                              {line.item_name}
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className="text-[11px] px-1.5 py-0.5 font-bold shrink-0"
                          >
                            {line.course}
                          </Badge>
                        </div>
                        {line.notes && (
                          <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold pl-9">
                            • {line.notes}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bump Action */}
                <div className="p-3.5 border-t border-border bg-muted/20">
                  {t.status === "PLACED" && (
                    <Button
                      onClick={() => handleBump(t.id)}
                      className="w-full h-11 font-bold text-sm bg-[#FF6A00] hover:bg-[#E05D00] text-[#0B1F3B] gap-2"
                    >
                      <Flame className="h-4 w-4" /> Start Cooking
                    </Button>
                  )}
                  {t.status === "PREPARING" && (
                    <Button
                      onClick={() => handleBump(t.id)}
                      className="w-full h-11 font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Mark Ready
                    </Button>
                  )}
                  {t.status === "READY" && (
                    <div className="flex gap-2">
                      {t.token_number != null && (
                        <Button
                          onClick={async () => {
                            try {
                              await ordersApi.callToken(t.id);
                              await fetchTickets();
                            } catch {
                              // ignore
                            }
                          }}
                          data-testid={`kds-call-token-${t.token_number}`}
                          className="h-11 font-bold text-xs bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] gap-1.5"
                        >
                          <Volume2 className="h-4 w-4" /> Call #{t.token_number}
                        </Button>
                      )}
                      <Button
                        onClick={() => handleBump(t.id)}
                        variant="outline"
                        className="flex-1 h-11 font-bold text-xs text-foreground gap-1.5"
                      >
                        Serve Food
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
