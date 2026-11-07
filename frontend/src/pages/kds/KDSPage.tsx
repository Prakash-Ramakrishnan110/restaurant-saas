import React, { useState, useEffect, useRef } from "react";
import { ChefHat, Clock, CheckCircle2, Volume2, VolumeX, Flame } from "lucide-react";
import { ordersApi, KDSTicket } from "../../api/orders";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

export const KDSPage: React.FC = () => {
  const { activeTenant } = useAuth();
  const [tickets, setTickets] = useState<KDSTicket[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("ALL");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const previousTicketCount = useRef<number>(0);

  // Play Web Audio chime on new incoming tickets
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
      const newTickets = res.data || [];

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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background font-sans overflow-hidden">
      {/* Header Bar */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-[#FF6A00]" />
          <div>
            <h1 className="text-lg font-extrabold font-heading text-foreground">
              Kitchen Display System (KDS)
            </h1>
            <p className="text-xs text-muted-foreground">
              Live station tickets with automatic 3s auto-sync and SLA countdowns.
            </p>
          </div>
        </div>

        {/* Station Filter & Sound Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/40">
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
            {tickets.length} Active Tickets
          </Badge>
        </div>
      </div>

      {/* Ticket Cards Grid */}
      <div className="flex-1 overflow-x-auto p-4 flex gap-4 items-start">
        {tickets.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-12 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 text-emerald-500/40 mb-3" />
            <h3 className="text-base font-bold text-foreground">Kitchen Queue Clear!</h3>
            <p className="text-xs text-muted-foreground mt-1">
              No active tickets in preparation for this station.
            </p>
          </div>
        ) : (
          tickets.map((t) => {
            const isLate = t.elapsed_minutes >= 20;
            const isWarning = t.elapsed_minutes >= 10 && t.elapsed_minutes < 20;

            return (
              <div
                key={t.id}
                className={`w-80 shrink-0 rounded-xl border flex flex-col bg-card shadow-sm transition-all ${
                  isLate
                    ? "border-destructive ring-2 ring-destructive/40 animate-pulse bg-red-50/20 dark:bg-red-950/20"
                    : isWarning
                      ? "border-amber-400 bg-amber-50/20 dark:bg-amber-950/20"
                      : "border-border"
                }`}
              >
                {/* Ticket Header */}
                <div
                  className={`p-3 rounded-t-xl border-b flex items-center justify-between ${
                    isLate
                      ? "bg-destructive text-white"
                      : isWarning
                        ? "bg-amber-500 text-white"
                        : "bg-[#0A192F] text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-extrabold text-base">{t.table_label}</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-black/20 text-white border-none"
                    >
                      {t.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold font-mono">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{t.elapsed_minutes}m</span>
                  </div>
                </div>

                {/* Ticket Order Notes */}
                {t.notes && (
                  <div className="bg-amber-100 dark:bg-amber-950/40 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200 font-semibold border-b border-amber-200">
                    ⚠️ {t.notes}
                  </div>
                )}

                {/* Line Items List */}
                <div className="p-3 flex-1 space-y-2 overflow-y-auto max-h-[360px]">
                  {t.items.map((line) => (
                    <div
                      key={line.id}
                      className="flex flex-col py-1 border-b border-border/40 last:border-none"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-[#FF6A00] min-w-[20px]">
                            {line.quantity}×
                          </span>
                          <span className="font-bold text-xs text-foreground">
                            {line.item_name}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 font-bold">
                          {line.course}
                        </Badge>
                      </div>
                      {line.notes && (
                        <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold pl-6">
                          • {line.notes}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bump Action Buttons */}
                <div className="p-3 border-t border-border bg-muted/20 flex gap-2">
                  {t.status === "PLACED" && (
                    <Button
                      onClick={() => handleBump(t.id)}
                      className="w-full h-10 font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
                    >
                      <Flame className="h-4 w-4" /> Start Cooking
                    </Button>
                  )}
                  {t.status === "PREPARING" && (
                    <Button
                      onClick={() => handleBump(t.id)}
                      className="w-full h-10 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
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
          })
        )}
      </div>
    </div>
  );
};
