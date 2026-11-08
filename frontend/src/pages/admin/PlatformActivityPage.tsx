import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Search, RefreshCw, Clock, User, Eye, X, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";

interface PlatformAuditRecord {
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

export const PlatformActivityPage: React.FC = () => {
  const [logs, setLogs] = useState<PlatformAuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<PlatformAuditRecord | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ListResponse<PlatformAuditRecord>>("/audit-logs/");
      const list = unwrapList<PlatformAuditRecord>(res.data);
      setLogs(list);
    } catch {
      setError("Failed to load platform-wide audit log.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.actor_name.toLowerCase().includes(q) ||
      log.actor_email.toLowerCase().includes(q) ||
      log.entity_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            Platform Activity Log{" "}
            <span className="text-xs text-muted-foreground font-normal">நிர்வாக பதிவு</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Authoritative platform-wide audit log of tenant provisioning, plan changes, suspensions,
            and resets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/admin">
            <Button variant="outline" size="sm">
              Platform Dashboard
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tenant ID, administrator, or action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 text-xs border-0 bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
          />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase font-bold text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity Type & ID</th>
                  <th className="px-4 py-3">Admin / Actor</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Loading platform audit stream...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No platform events recorded yet.
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
                      <td className="px-4 py-3 text-xs font-medium text-foreground">
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
                            onClick={() => setSelectedRecord(log)}
                          >
                            <Eye className="w-3.5 h-3.5 text-primary" />
                            Diff
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

      {/* Diff Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Platform Action:{" "}
                  <span className="font-mono text-xs">{selectedRecord.action}</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  By {selectedRecord.actor_name} on{" "}
                  {new Date(selectedRecord.timestamp).toLocaleString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setSelectedRecord(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              {selectedRecord.before_state && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Before State
                  </h4>
                  <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto text-foreground">
                    {JSON.stringify(selectedRecord.before_state, null, 2)}
                  </pre>
                </div>
              )}

              {selectedRecord.after_state && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    After State
                  </h4>
                  <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto text-foreground">
                    {JSON.stringify(selectedRecord.after_state, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex justify-end bg-muted/40">
              <Button size="sm" onClick={() => setSelectedRecord(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
