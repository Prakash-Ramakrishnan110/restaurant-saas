import React, { useState, useEffect, useRef } from "react";
import { Upload, CheckCircle2, AlertCircle, Sparkles, Trash2, X } from "lucide-react";
import { apiClient } from "../../api/client";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";

interface UnassignedPhotoItem {
  id: string;
  original_filename: string;
  image_thumb: string;
  proposed_item: string | null;
  proposed_item_name: string;
  match_score: number;
  match_tier: "LIKELY" | "CHECK" | "NO_MATCH";
}

interface UploadQueueItem {
  localId: string;
  file: File;
  status: "PENDING" | "UPLOADING" | "DONE" | "ERROR";
  error?: string;
}

interface BulkPhotoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItems: Array<{ id: string; name: string }>;
  onComplete: () => Promise<void>;
}

export const BulkPhotoUploadModal: React.FC<BulkPhotoUploadModalProps> = ({
  open,
  onOpenChange,
  menuItems,
  onComplete,
}) => {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [tray, setTray] = useState<UnassignedPhotoItem[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchTray = async () => {
    try {
      const res = await apiClient.get<UnassignedPhotoItem[]>("/menu/photos/unassigned/");
      const list = Array.isArray(res.data) ? res.data : [];
      setTray(list);
      const nextMap: Record<string, string> = {};
      list.forEach((p) => {
        if (p.proposed_item) nextMap[p.id] = p.proposed_item;
      });
      setSelectedMap(nextMap);
    } catch {
      // Ignore initial load errors
    }
  };

  useEffect(() => {
    if (open) {
      void fetchTray();
    }
  }, [open]);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).slice(0, 50);
    const items: UploadQueueItem[] = arr.map((f, idx) => ({
      localId: `${Date.now()}-${idx}`,
      file: f,
      status: "PENDING",
    }));
    setQueue(items);
    void startBatchUpload(items);
  };

  const startBatchUpload = async (items: UploadQueueItem[]) => {
    cancelledRef.current = false;
    setUploading(true);
    setError(null);
    setNotice(null);

    // Upload 3 at a time
    for (let i = 0; i < items.length; i += 3) {
      if (cancelledRef.current) break;
      const chunk = items.slice(i, i + 3);
      await Promise.all(
        chunk.map(async (entry) => {
          if (cancelledRef.current) return;
          setQueue((prev) =>
            prev.map((q) => (q.localId === entry.localId ? { ...q, status: "UPLOADING" } : q))
          );
          try {
            const fd = new FormData();
            fd.append("files", entry.file);
            const res = await apiClient.post<{ uploaded: any[]; errors: any[] }>(
              "/menu/photos/bulk-upload/",
              fd,
              { headers: { "Content-Type": "multipart/form-data" } }
            );
            if (res.data.errors && res.data.errors.length > 0) {
              setQueue((prev) =>
                prev.map((q) =>
                  q.localId === entry.localId
                    ? { ...q, status: "ERROR", error: res.data.errors[0].message }
                    : q
                )
              );
            } else {
              setQueue((prev) =>
                prev.map((q) => (q.localId === entry.localId ? { ...q, status: "DONE" } : q))
              );
            }
          } catch (err: any) {
            setQueue((prev) =>
              prev.map((q) =>
                q.localId === entry.localId
                  ? {
                      ...q,
                      status: "ERROR",
                      error: err?.response?.data?.errors?.[0]?.message || "Upload failed",
                    }
                  : q
              )
            );
          }
        })
      );
    }

    setUploading(false);
    await fetchTray();
  };

  const handleAttachPhoto = async (photoId: string) => {
    const itemId = selectedMap[photoId];
    if (!itemId) return;
    setError(null);
    try {
      await apiClient.post(`/menu/photos/unassigned/${photoId}/attach/`, { item_id: itemId });
      setNotice("Photo attached to menu item gallery.");
      await fetchTray();
      await onComplete();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not attach photo.");
    }
  };

  const handleApplyAllLikely = async () => {
    setError(null);
    try {
      const res = await apiClient.post<{ attached_count: number }>(
        "/menu/photos/unassigned/apply-likely/",
        {}
      );
      setNotice(`Attached ${res.data.attached_count} likely photo match(es).`);
      await fetchTray();
      await onComplete();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not apply likely matches.");
    }
  };

  const handleDeleteTrayPhoto = async (photoId: string) => {
    await apiClient.delete(`/menu/photos/unassigned/${photoId}/`);
    await fetchTray();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Upload className="w-4 h-4 text-[#FF6A00]" />
            Bulk Photo Upload &amp; Dish Matching
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          <div className="border-2 border-dashed border-border rounded-xl p-5 text-center space-y-2 bg-muted/20">
            <p className="font-semibold text-foreground">
              Choose up to 50 JPEG, PNG, or WebP photos (max 5 MB each, min 400×300 px)
            </p>
            <input
              type="file"
              data-testid="bulk-photo-file-input"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="mx-auto block text-xs"
            />
            {uploading && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  cancelledRef.current = true;
                  setUploading(false);
                }}
              >
                <X className="w-3.5 h-3.5 mr-1" /> Cancel Batch
              </Button>
            )}
          </div>

          {queue.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto border border-border rounded-lg p-2.5">
              {queue.map((q) => (
                <div key={q.localId} className="flex items-center justify-between text-[11px]">
                  <span className="truncate max-w-xs">{q.file.name}</span>
                  <span
                    className={
                      q.status === "ERROR"
                        ? "text-rose-600 font-semibold"
                        : q.status === "DONE"
                          ? "text-emerald-600 font-semibold"
                          : "text-muted-foreground"
                    }
                  >
                    {q.status === "ERROR" ? q.error : q.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {notice && (
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground">
              Unassigned Review Tray ({tray.length})
            </span>
            {tray.some((p) => p.match_tier === "LIKELY") && (
              <Button
                type="button"
                size="sm"
                data-testid="apply-all-likely-btn"
                onClick={() => void handleApplyAllLikely()}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold text-xs gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Apply all likely
              </Button>
            )}
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {tray.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground border border-border rounded-lg">
                No unassigned photos waiting for review.
              </div>
            ) : (
              tray.map((photo) => (
                <div
                  key={photo.id}
                  className="p-2.5 rounded-lg border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={photo.image_thumb}
                      alt={photo.original_filename}
                      className="w-12 h-12 rounded object-cover border border-border shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{photo.original_filename}</div>
                      <span
                        className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          photo.match_tier === "LIKELY"
                            ? "bg-emerald-100 text-emerald-900"
                            : photo.match_tier === "CHECK"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {photo.match_tier} ({Math.round(photo.match_score * 100)}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      aria-label={`Select dish for ${photo.original_filename}`}
                      value={selectedMap[photo.id] || ""}
                      onChange={(e) =>
                        setSelectedMap((prev) => ({ ...prev, [photo.id]: e.target.value }))
                      }
                      className="px-2 py-1.5 rounded border border-input bg-background text-xs max-w-[180px]"
                    >
                      <option value="">Choose dish...</option>
                      {menuItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!selectedMap[photo.id]}
                      onClick={() => void handleAttachPhoto(photo.id)}
                      className="h-8 text-xs bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold"
                    >
                      Attach
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Discard ${photo.original_filename}`}
                      onClick={() => void handleDeleteTrayPhoto(photo.id)}
                      className="h-8 w-8 p-0 text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
