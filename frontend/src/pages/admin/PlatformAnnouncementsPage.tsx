import React, { useState, useEffect, useCallback } from "react";
import {
  Megaphone,
  Plus,
  RefreshCw,
  Info,
  Wrench,
  Sparkles,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";

interface Announcement {
  id: string;
  title: string;
  message: string;
  announcement_type: "INFO" | "MAINTENANCE" | "FEATURE" | "WARNING";
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const PlatformAnnouncementsPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [announcementType, setAnnouncementType] =
    useState<Announcement["announcement_type"]>("INFO");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ListResponse<Announcement>>("/announcements/");
      setAnnouncements(unwrapList(res.data));
    } catch {
      setError("Failed to load platform announcements.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setIsSaving(true);
    try {
      await apiClient.post("/announcements/", {
        title: title.trim(),
        message: message.trim(),
        announcement_type: announcementType,
        is_active: isActive,
      });
      setIsCreateOpen(false);
      setTitle("");
      setMessage("");
      setAnnouncementType("INFO");
      setIsActive(true);
      fetchAnnouncements();
    } catch {
      setError("Failed to publish announcement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await apiClient.patch(`/announcements/${id}/`, { is_active: !current });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: !current } : a))
      );
    } catch {
      setError("Failed to toggle announcement status.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await apiClient.delete(`/announcements/${id}/`);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError("Failed to delete announcement.");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-[#FF6A00]" />
            Platform Broadcasts &amp; Announcements
          </h1>
          <p className="text-sm text-muted-foreground">
            Publish maintenance windows, version releases, and critical system alerts to all
            restaurants (A-05).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAnnouncements} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#FF6A00]/90 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Broadcast
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Announcements List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Loading announcements...
          </div>
        ) : announcements.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-border rounded-xl">
            <Megaphone className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">No broadcasts published</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a broadcast to notify restaurant owners of scheduled maintenance or updates.
            </p>
          </div>
        ) : (
          announcements.map((a) => {
            const isMaint = a.announcement_type === "MAINTENANCE";
            const isFeature = a.announcement_type === "FEATURE";
            const isWarn = a.announcement_type === "WARNING";

            return (
              <div
                key={a.id}
                className="p-5 rounded-xl border border-border bg-card shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[11px] font-bold rounded flex items-center gap-1 ${
                        isMaint
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                          : isFeature
                            ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-800"
                            : isWarn
                              ? "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800"
                              : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800"
                      }`}
                    >
                      {isMaint && <Wrench className="w-3 h-3" />}
                      {isFeature && <Sparkles className="w-3 h-3" />}
                      {isWarn && <AlertTriangle className="w-3 h-3" />}
                      {!isMaint && !isFeature && !isWarn && <Info className="w-3 h-3" />}
                      {a.announcement_type}
                    </span>

                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </span>

                    {a.is_active ? (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        LIVE
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        ARCHIVED
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-foreground">{a.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{a.message}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(a.id, a.is_active)}
                    className="text-xs"
                  >
                    {a.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(a.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Broadcast Creation Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Platform Announcement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAnnouncement} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Broadcast Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Scheduled Database Maintenance Notice"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Announcement Category
              </label>
              <select
                value={announcementType}
                onChange={(e) =>
                  setAnnouncementType(e.target.value as Announcement["announcement_type"])
                }
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              >
                <option value="INFO">General Information</option>
                <option value="MAINTENANCE">Scheduled Maintenance</option>
                <option value="FEATURE">New Feature Release</option>
                <option value="WARNING">Urgent Service Alert</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Announcement Message
              </label>
              <textarea
                rows={4}
                required
                placeholder="Details of the scheduled window, affected services, and expected resolution time..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-border text-[#FF6A00] focus:ring-[#FF6A00]"
              />
              <span>Broadcast immediately to all restaurant tenants</span>
            </label>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#FF6A00]/90 font-semibold"
              >
                {isSaving ? "Publishing..." : "Publish Broadcast"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
