import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Search,
  Calendar,
  RefreshCw,
  Eye,
  X,
  ShieldCheck,
  Clock,
  User,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";

interface AuditRecord {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  timestamp: string;
  actor_name: string;
  actor_email: string;
}

export const ActivityLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchActor, setSearchActor] = useState("");
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>("ALL");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [viewingRecord, setViewingRecord] = useState<AuditRecord | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (selectedDate) params.date = selectedDate;
      const res = await apiClient.get<ListResponse<AuditRecord>>("/audit-logs/", { params });
      const rawList = unwrapList<AuditRecord>(res.data);
      setLogs(rawList);
    } catch {
      setError("Failed to fetch audit activity records. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    const matchesActor =
      !searchActor ||
      log.actor_name.toLowerCase().includes(searchActor.toLowerCase()) ||
      log.actor_email.toLowerCase().includes(searchActor.toLowerCase()) ||
      log.action.toLowerCase().includes(searchActor.toLowerCase());

    const matchesAction =
      selectedActionFilter === "ALL" ||
      (selectedActionFilter === "ORDER" && log.action.startsWith("order")) ||
      (selectedActionFilter === "MENU" && log.action.startsWith("menu")) ||
      (selectedActionFilter === "STAFF" && log.action.startsWith("staff")) ||
      (selectedActionFilter === "TENANT" &&
        (log.action.startsWith("tenant") || log.action.startsWith("business")));

    return matchesActor && matchesAction;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Activity Log{" "}
            <span className="text-xs text-muted-foreground font-normal">செயல்பாட்டு பதிவு</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Tamper-evident audit trail of all staff and system operations across your venue.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={fetchLogs}
          disabled={isLoading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Log
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search actor or action..."
                value={searchActor}
                onChange={(e) => setSearchActor(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant={selectedActionFilter === "ALL" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSelectedActionFilter("ALL")}
              >
                All
              </Button>
              <Button
                variant={selectedActionFilter === "ORDER" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSelectedActionFilter("ORDER")}
              >
                Orders
              </Button>
              <Button
                variant={selectedActionFilter === "MENU" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSelectedActionFilter("MENU")}
              >
                Menu
              </Button>
              <Button
                variant={selectedActionFilter === "STAFF" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSelectedActionFilter("STAFF")}
              >
                Staff
              </Button>
              <Button
                variant={selectedActionFilter === "TENANT" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSelectedActionFilter("TENANT")}
              >
                Settings
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 px-2 text-xs border rounded-md bg-background"
            />
            {selectedDate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setSelectedDate("")}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase font-bold text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                        <span className="text-xs text-muted-foreground">
                          Loading audit events...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No matching audit records found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground font-medium">
                        {log.entity_type}{" "}
                        <span className="font-mono text-muted-foreground">
                          ({log.entity_id.slice(0, 8)})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-1.5 text-foreground font-semibold">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {log.actor_name}
                        </div>
                        {log.actor_email && (
                          <div className="text-[11px] text-muted-foreground pl-5">
                            {log.actor_email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {log.before_state || log.after_state ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => setViewingRecord(log)}
                          >
                            <Eye className="w-3.5 h-3.5 text-primary" />
                            View Diff
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Before / After Diff Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Audit Event Diff:{" "}
                  <span className="font-mono text-xs">{viewingRecord.action}</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Recorded at {new Date(viewingRecord.timestamp).toLocaleString()} by{" "}
                  {viewingRecord.actor_name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewingRecord(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              {viewingRecord.before_state && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Before State (முந்தைய நிலை)
                  </h4>
                  <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto text-foreground">
                    {JSON.stringify(viewingRecord.before_state, null, 2)}
                  </pre>
                </div>
              )}

              {viewingRecord.after_state && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    After State (மாற்றப்பட்ட நிலை)
                  </h4>
                  <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto text-foreground">
                    {JSON.stringify(viewingRecord.after_state, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex justify-end bg-muted/40">
              <Button size="sm" onClick={() => setViewingRecord(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
