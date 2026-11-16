import React, { useEffect, useState } from "react";
import { Phone, MapPin, RefreshCw, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";

export interface DemoLeadItem {
  id: string;
  name: string;
  phone: string;
  business_type: string;
  city: string;
  message: string;
  language: string;
  consent: boolean;
  status: "NEW" | "CONTACTED" | "CLOSED";
  notes: string;
  created_at: string;
  updated_at: string;
}

const STATUS_BADGE: Record<DemoLeadItem["status"], string> = {
  NEW: "bg-orange-100 text-[#C2410C] dark:bg-orange-950/60 dark:text-orange-300",
  CONTACTED: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  CLOSED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
};

export const PlatformLeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<DemoLeadItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | DemoLeadItem["status"]>("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const query = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
      const res = await apiClient.get<ListResponse<DemoLeadItem> | DemoLeadItem[]>(
        `/platform/leads/${query}`
      );
      const list = unwrapList<DemoLeadItem>(res.data);
      setLeads(list);
      const drafts: Record<string, string> = {};
      list.forEach((item) => {
        drafts[item.id] = item.notes || "";
      });
      setNotesDraft(drafts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const updateLead = async (id: string, nextStatus: DemoLeadItem["status"]) => {
    setSavingId(id);
    try {
      const res = await apiClient.patch<DemoLeadItem>(`/platform/leads/${id}/`, {
        status: nextStatus,
        notes: notesDraft[id] ?? "",
      });
      setLeads((prev) => prev.map((item) => (item.id === id ? res.data : item)));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold font-heading text-foreground">Demo Leads</h1>
          <p className="text-sm text-muted-foreground">
            Public demo requests from the marketing website. Status updates are recorded in the
            platform audit log.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/40">
            {(["ALL", "NEW", "CONTACTED", "CLOSED"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                  statusFilter === st
                    ? "bg-[#0A192F] text-white dark:bg-white dark:text-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st === "ALL" ? "All" : st}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLeads}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {leads.length === 0 && !loading ? (
        <Card className="border border-dashed border-border">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No demo leads found for this filter yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {leads.map((lead) => (
            <Card key={lead.id} className="border border-border">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base font-heading">{lead.name}</CardTitle>
                      <Badge
                        className={`text-[11px] font-bold border-none ${STATUS_BADGE[lead.status]}`}
                      >
                        {lead.status}
                      </Badge>
                      <Badge variant="outline" className="text-[11px] font-semibold">
                        {lead.business_type}
                      </Badge>
                      <Badge variant="secondary" className="text-[11px] font-semibold uppercase">
                        {lead.language}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-4 text-xs">
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                        <Phone className="h-3.5 w-3.5 text-[#FF6A00]" />
                        {lead.phone}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {lead.city}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(lead.created_at).toLocaleString()}
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {lead.message && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-foreground flex items-start gap-2">
                    <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <span>{lead.message}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={notesDraft[lead.id] ?? ""}
                    onChange={(e) =>
                      setNotesDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))
                    }
                    placeholder="Add call notes or follow-up details..."
                    className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-xs text-foreground"
                  />

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(["NEW", "CONTACTED", "CLOSED"] as const).map((st) => (
                      <Button
                        key={st}
                        size="sm"
                        variant={lead.status === st ? "default" : "outline"}
                        disabled={savingId === lead.id}
                        onClick={() => updateLead(lead.id, st)}
                        className={
                          lead.status === st
                            ? "h-9 text-xs font-bold bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#E05D00]"
                            : "h-9 text-xs font-semibold"
                        }
                      >
                        {st === "CLOSED" && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                        {st}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
