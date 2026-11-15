import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChefHat, Clock, CheckCircle2, Volume2, VolumeX, Flame, Search } from "lucide-react";
import { ordersApi, KDSTicket } from "../../api/orders";
import { unwrapList } from "../../api/pagination";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

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
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const previousTicketCount = useRef<number>(0);

  // Play Web Audio chime on new incoming tickets
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880.0, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch {
      // AudioContext unavailable or blocked
    }
  };

  const fetchTickets = async () => {
    if (!activeTenant) return;
    try {
      const station = selectedStation === "ALL" ? undefined : selectedStation;
      const res = await ordersApi.getKDSTickets(station);
      const newTickets = unwrapList<KDSTicket>(res.data);

      // Check if new tickets arrived to sound alert
      if (newTickets.length > previousTicketCount.current && previousTicketCount.current > 0) {
        playChime();
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
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-background font-sans">
      {/* Sticky Header & Filter Bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-3 sm:px-5 py-3 space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ChefHat className="h-6 w-6 shrink-0 text-[#FF6A00]" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold font-heading text-foreground leading-tight">
                Kitchen Display System (KDS)
              </h1>
              <p className="text-xs text-muted-foreground">
                Live station queue with automatic 3s auto-sync and SLA timers.
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
                playChime();
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
              onClick={() => setSoundEnabled(!soundEnabled)}
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

        {/* Queue Filters: Status, Source, Search, Sort */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/30">
              {(
                [
                  { id: "ALL", label: "All Status" },
                  { id: "PLACED", label: "Queued" },
                  { id: "PREPARING", label: "Cooking" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setStatusFilter(opt.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    statusFilter === opt.id
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Source Filter */}
            <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/30">
              {(
                [
                  { id: "ALL", label: "All Sources" },
                  { id: "QR", label: "QR Orders" },
                  { id: "POS", label: "Staff POS" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSourceFilter(opt.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    sourceFilter === opt.id
                      ? "bg-[#FF6A00] text-[#0B1F3B] shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
            <div className="relative min-w-[190px] flex-1 sm:w-56">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search table or dish..."
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/40"
              />
            </div>

            <button
              onClick={() => setSortOrder((prev) => (prev === "OLDEST" ? "NEWEST" : "OLDEST"))}
              className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              title="Toggle ticket sort order"
            >
              Sort: {sortOrder === "OLDEST" ? "Oldest first (SLA)" : "Newest first"}
            </button>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setStatusFilter("ALL");
                  setSourceFilter("ALL");
                  setSearchQuery("");
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold text-[#FF6A00] hover:bg-[#FF6A00]/10 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Queue List (Non-card layout) */}
      <div className="flex-1 p-3 sm:p-5">
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
          <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
            {filteredTickets.map((t) => {
              const isLate = t.elapsed_minutes >= 20;
              const isWarning = t.elapsed_minutes >= 10 && t.elapsed_minutes < 20;

              return (
                <div
                  key={t.id}
                  className={`flex flex-col lg:flex-row lg:items-center gap-4 p-4 border-l-[6px] transition-colors hover:bg-muted/20 ${
                    isLate
                      ? "border-l-destructive"
                      : isWarning
                        ? "border-l-amber-400"
                        : "border-l-emerald-500"
                  }`}
                >
                  {/* Left: Table, Source, Status, Elapsed Timer */}
                  <div className="lg:w-52 shrink-0 flex flex-row lg:flex-col items-center lg:items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-extrabold text-lg text-foreground">
                        {t.table_label}
                      </span>
                      {t.source === "QR" && (
                        <Badge className="text-xs bg-[#FF6A00] text-[#0B1F3B] font-bold border-none">
                          QR
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs font-semibold">
                        {t.status}
                      </Badge>
                    </div>
                    <div
                      className={`inline-flex items-center gap-1.5 text-xs font-bold font-mono px-2.5 py-1 rounded-full shrink-0 ${
                        isLate
                          ? "bg-destructive text-white"
                          : isWarning
                            ? "bg-amber-500 text-white"
                            : "bg-muted text-foreground"
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatElapsed(t.elapsed_minutes)}</span>
                    </div>
                  </div>

                  {/* Middle: Order Notes + Line Items */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {t.notes && (
                      <div className="rounded-md bg-amber-100/80 dark:bg-amber-950/40 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200 font-semibold border border-amber-200/80 dark:border-amber-800/50">
                        ⚠️ {t.notes}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                      {(t.items || []).map((line) => (
                        <div
                          key={line.id}
                          className="flex flex-col py-1 border-b border-border/40 sm:border-none"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-extrabold text-base text-[#FF6A00] min-w-[26px]">
                                {line.quantity}×
                              </span>
                              <span className="font-semibold text-sm text-foreground truncate">
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

                  {/* Right: Bump Action */}
                  <div className="lg:w-44 shrink-0 flex items-center justify-end">
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
                      <Button
                        onClick={() => handleBump(t.id)}
                        variant="outline"
                        className="w-full h-10 font-bold text-xs text-foreground gap-1.5"
                      >
                        Serve Food
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
