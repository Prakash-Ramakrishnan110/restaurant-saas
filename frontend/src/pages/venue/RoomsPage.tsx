import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bed,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  Utensils,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";

interface Section {
  id: string;
  name: string;
}

interface RoomTable {
  id: string;
  label: string;
  table_type: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BLOCKED" | "CLEANING" | "MAINTENANCE";
  section: string;
  section_name?: string;
}

export const RoomsPage: React.FC = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomTable[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRoomLabel, setNewRoomLabel] = useState("");
  const [newRoomCapacity, setNewRoomCapacity] = useState(2);
  const [newRoomSection, setNewRoomSection] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoomTable | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [secRes, tablesRes] = await Promise.all([
        apiClient.get<ListResponse<Section>>("/sections/"),
        apiClient.get<ListResponse<RoomTable>>("/tables/"),
      ]);

      const secList = unwrapList(secRes.data);
      const allTables = unwrapList(tablesRes.data);

      setSections(secList);
      if (secList.length > 0 && !newRoomSection) {
        setNewRoomSection(secList[0].id);
      }

      // Filter only room type tables or tables with Room prefix
      const roomTables = allTables.filter(
        (t) => t.table_type === "ROOM" || t.label.toLowerCase().includes("room")
      );
      setRooms(roomTables);
    } catch {
      setError("Failed to load rooms and floors. Please check connectivity.");
    } finally {
      setIsLoading(false);
    }
  }, [newRoomSection]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateStatus = async (roomId: string, newStatus: string) => {
    try {
      await apiClient.patch(`/tables/${roomId}/`, { status: newStatus });
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? {
                ...r,
                status: newStatus as RoomTable["status"],
              }
            : r
        )
      );
    } catch {
      setError("Failed to update room status.");
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomLabel.trim() || !newRoomSection) return;

    setIsSaving(true);
    try {
      await apiClient.post("/tables/", {
        label: newRoomLabel.trim(),
        table_type: "ROOM",
        capacity: newRoomCapacity,
        section: newRoomSection,
        status: "AVAILABLE",
      });
      setIsAddOpen(false);
      setNewRoomLabel("");
      setNewRoomCapacity(2);
      fetchData();
    } catch {
      setError("Failed to add new room.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setError(null);
    try {
      await apiClient.delete(`/tables/${deleteTarget.id}/`);
      setDeleteTarget(null);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to delete room.");
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (selectedSection !== "ALL" && room.section !== selectedSection) {
        return false;
      }
      if (statusFilter !== "ALL" && room.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return room.label.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rooms, selectedSection, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = rooms.length;
    const available = rooms.filter((r) => r.status === "AVAILABLE").length;
    const occupied = rooms.filter((r) => r.status === "OCCUPIED").length;
    const other = total - available - occupied;
    return { total, available, occupied, other };
  }, [rooms]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bed className="w-6 h-6 text-[#FF6A00]" />
            Hotel Rooms & Suites
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage room occupancy, housekeeping turnaround, and room-service ordering (H-03, H-05).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#FF6A00]/90 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Room
          </Button>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Utensils className="w-4 h-4 text-[#FF6A00] flex-shrink-0" />
          <span className="text-foreground">
            <strong>In-Room Dining & Suites:</strong> You are managing hotel guest rooms. To manage
            dining tables in your hotel restaurant or banquet, visit Dining Tables.
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate("/venue/tables")}
          className="text-xs shrink-0"
        >
          Go to Dining Tables &rarr;
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Total Rooms</span>
          <div className="text-2xl font-bold text-foreground mt-1">{stats.total}</div>
        </div>
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-500/10">
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
            Available
          </span>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {stats.available}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-500/10">
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase">
            Occupied
          </span>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
            {stats.occupied}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-500/10">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase">
            Housekeeping / Other
          </span>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">
            {stats.other}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search room number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
            />
          </div>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="px-3 py-1.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
          >
            <option value="ALL">All Floors / Wings</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {["ALL", "AVAILABLE", "OCCUPIED", "CLEANING"].map((st) => (
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

      {/* Rooms Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Loading hotel rooms...
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-xl">
          <Bed className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold text-foreground">No hotel rooms found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create rooms with table type &quot;Hotel Room&quot; to manage room service and
            housekeeping.
          </p>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="mt-4 bg-[#FF6A00] text-[#0B1F3B] font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add First Room
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room) => {
            const isAvail = room.status === "AVAILABLE";
            const isOcc = room.status === "OCCUPIED";

            return (
              <div
                key={room.id}
                className="p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-foreground">{room.label}</span>
                    <span
                      className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                        isAvail
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                          : isOcc
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                      }`}
                    >
                      {room.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Capacity: {room.capacity} Guests</div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {isAvail ? (
                      <button
                        onClick={() => handleUpdateStatus(room.id, "OCCUPIED")}
                        className="px-2 py-1 text-xs font-medium rounded bg-muted hover:bg-muted/80 text-foreground"
                        title="Mark Occupied"
                      >
                        Check-in
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(room.id, "AVAILABLE")}
                        className="px-2 py-1 text-xs font-medium rounded bg-muted hover:bg-muted/80 text-foreground"
                        title="Mark Available"
                      >
                        Check-out
                      </button>
                    )}
                    <button
                      onClick={() =>
                        handleUpdateStatus(
                          room.id,
                          room.status === "CLEANING" ? "AVAILABLE" : "CLEANING"
                        )
                      }
                      className="px-2 py-1 text-xs font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                      title="Toggle Housekeeping"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(room)}
                      className="px-2 py-1 text-xs font-medium rounded bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Delete Room"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2 border-[#FF6A00]/40 text-[#FF6A00] hover:bg-[#FF6A00]/10"
                    onClick={() => navigate(`/room-service?room=${encodeURIComponent(room.label)}`)}
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 mr-1" />
                    Room Service
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Room Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Hotel Room / Suite</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRoom} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Room Number / Label
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Room 204 or Suite 401"
                value={newRoomLabel}
                onChange={(e) => setNewRoomLabel(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Floor / Wing Section
              </label>
              <select
                required
                value={newRoomSection}
                onChange={(e) => setNewRoomSection(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Guest Capacity
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={newRoomCapacity}
                onChange={(e) => setNewRoomCapacity(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#FF6A00]/90 font-semibold"
              >
                {isSaving ? "Saving..." : "Create Room"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Room Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.label || "Room"}?`}
        description="This will permanently delete this room and its QR code. Rooms with existing order history cannot be deleted."
        confirmLabel="Delete Room"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDeleteRoom}
      />
    </div>
  );
};
