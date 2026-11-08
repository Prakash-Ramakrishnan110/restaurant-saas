import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LifeBuoy, Search, RefreshCw } from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  contact_phone: string;
  contact_email: string;
  admin_notes: string;
  resolved_at?: string | null;
  tenant_name?: string;
  created_at: string;
  updated_at: string;
}

export const PlatformSupportPage: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selected ticket for resolution/notes modal
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [nextStatus, setNextStatus] = useState<SupportTicket["status"]>("IN_PROGRESS");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ListResponse<SupportTicket>>("/support-tickets/");
      setTickets(unwrapList(res.data));
    } catch {
      setError("Failed to load customer support tickets.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleOpenTicket = (t: SupportTicket) => {
    setSelectedTicket(t);
    setAdminNotes(t.admin_notes || "");
    setNextStatus(t.status);
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setIsUpdating(true);
    try {
      await apiClient.patch(`/support-tickets/${selectedTicket.id}/`, {
        status: nextStatus,
        admin_notes: adminNotes.trim(),
        resolved_at: nextStatus === "RESOLVED" ? new Date().toISOString() : null,
      });
      setSelectedTicket(null);
      fetchTickets();
    } catch {
      setError("Failed to update ticket status.");
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.subject.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.tenant_name && t.tenant_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [tickets, statusFilter, searchQuery]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-[#FF6A00]" />
            Platform Support &amp; Incident Desk
          </h1>
          <p className="text-sm text-muted-foreground">
            Customer inquiries, hardware/printer troubleshooting, and platform resolution history
            (A-04).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchTickets} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border">
        <div className="relative flex-1 sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tickets by subject or restaurant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                statusFilter === st
                  ? "bg-[#0B1F3B] text-white border-[#0B1F3B] dark:bg-white dark:text-[#0B1F3B]"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets List */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3">Subject / Issue</th>
                <th className="px-4 py-3">Restaurant</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Opened</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading support tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No support tickets found matching this filter.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => {
                  const isResolved = t.status === "RESOLVED";
                  const isHigh = t.priority === "HIGH" || t.priority === "URGENT";

                  return (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <div>{t.subject}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 font-normal mt-0.5">
                          {t.description}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div className="font-medium text-foreground">{t.tenant_name || "Self"}</div>
                        {t.contact_phone && <div>{t.contact_phone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                            isHigh
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                            isResolved
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                              : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenTicket(t)}
                          className="text-xs h-7"
                        >
                          Review &amp; Reply
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Response Modal */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Support Ticket</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <form onSubmit={handleUpdateTicket} className="space-y-4 pt-2">
              <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
                <div className="font-bold text-foreground text-sm">{selectedTicket.subject}</div>
                <div className="text-muted-foreground">{selectedTicket.description}</div>
                <div className="pt-2 text-[11px] text-muted-foreground">
                  Restaurant: {selectedTicket.tenant_name || "Self"} | Phone:{" "}
                  {selectedTicket.contact_phone || "N/A"}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Ticket Status
                </label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as SupportTicket["status"])}
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Admin Resolution / Response Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Record diagnosis, troubleshooting steps taken, and instructions sent to restaurant..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSelectedTicket(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#FF6A00]/90 font-semibold"
                >
                  {isUpdating ? "Saving..." : "Save Resolution"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
