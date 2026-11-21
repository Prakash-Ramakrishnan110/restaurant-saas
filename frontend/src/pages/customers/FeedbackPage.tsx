import React, { useState, useEffect, useCallback } from "react";
import { MessageSquare, Star, Download, CheckCircle2, EyeOff } from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { Button } from "../../components/ui/button";

interface FeedbackRow {
  id: string;
  order_number: string;
  branch_name: string;
  food_rating: number;
  service_rating: number;
  comment: string;
  suggestion_type: string;
  is_hidden: boolean;
  is_resolved: boolean;
  owner_note: string;
  created_at: string;
}

export const FeedbackPage: React.FC = () => {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unansweredOnly, setUnansweredOnly] = useState(false);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ListResponse<FeedbackRow>>("/orders/feedback/", {
        params: unansweredOnly ? { unanswered: "true" } : undefined,
      });
      setRows(unwrapList(res.data));
    } finally {
      setLoading(false);
    }
  }, [unansweredOnly]);

  useEffect(() => {
    void fetchFeedback();
  }, [fetchFeedback]);

  const handleModerate = async (
    id: string,
    patch: { is_resolved?: boolean; is_hidden?: boolean }
  ) => {
    await apiClient.post(`/orders/feedback/${id}/moderate/`, patch);
    await fetchFeedback();
  };

  const handleExportCsv = async () => {
    const res = await apiClient.get<Blob>("/orders/feedback/export-csv/", { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "guest-feedback.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-[#FF6A00]" />
            Verified Guest Feedback
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Private feedback submitted by verified QR orders (Owner &amp; Branch Manager only).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={unansweredOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setUnansweredOnly((prev) => !prev)}
            className={unansweredOnly ? "bg-[#0B1F3B] text-white" : ""}
          >
            {unansweredOnly ? "Showing Unanswered" : "Filter Unanswered"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleExportCsv()}
            className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Branch</th>
              <th className="p-3">Ratings</th>
              <th className="p-3">Topic</th>
              <th className="p-3">Comment</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Loading feedback...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No verified guest feedback recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 font-mono font-bold">{r.order_number}</td>
                  <td className="p-3">{r.branch_name}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Star className="w-3.5 h-3.5 text-[#FF6A00]" />
                      Food {r.food_rating}/5 • Service {r.service_rating}/5
                    </span>
                  </td>
                  <td className="p-3">{r.suggestion_type}</td>
                  <td className="p-3 max-w-xs">{r.comment || "—"}</td>
                  <td className="p-3">
                    {r.is_resolved ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                        RESOLVED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                        OPEN
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-1.5">
                    {!r.is_resolved && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleModerate(r.id, { is_resolved: true })}
                        className="h-7 text-[11px] bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Resolved
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleModerate(r.id, { is_hidden: !r.is_hidden })}
                      className="h-7 text-[11px]"
                    >
                      <EyeOff className="w-3 h-3 mr-1" /> {r.is_hidden ? "Unhide" : "Hide"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
