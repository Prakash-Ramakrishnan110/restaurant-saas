import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, RefreshCw, Heart, ShieldCheck, Edit2 } from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  consent_given: boolean;
  dietary_preference: "VEG" | "NON_VEG" | "EGG" | "JAIN" | "VEGAN" | "NONE";
  allergies: string;
  notes: string;
  visit_count: number;
  total_spend_paise: number;
  last_visit_at: string;
}

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dietFilter, setDietFilter] = useState<string>("ALL");

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consentGiven, setConsentGiven] = useState(true);
  const [dietaryPreference, setDietaryPreference] =
    useState<Customer["dietary_preference"]>("NONE");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ListResponse<Customer>>("/customers/");
      setCustomers(unwrapList(res.data));
    } catch {
      setError("Failed to load customer profiles.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setName("");
    setPhone("");
    setEmail("");
    setConsentGiven(true);
    setDietaryPreference("NONE");
    setAllergies("");
    setNotes("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email || "");
    setConsentGiven(c.consent_given);
    setDietaryPreference(c.dietary_preference);
    setAllergies(c.allergies || "");
    setNotes(c.notes || "");
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        consent_given: consentGiven,
        dietary_preference: dietaryPreference,
        allergies: allergies.trim(),
        notes: notes.trim(),
      };

      if (editingId) {
        await apiClient.patch(`/customers/${editingId}/`, payload);
      } else {
        await apiClient.post("/customers/", payload);
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch {
      setError("Failed to save guest profile. Please ensure phone number is unique.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (dietFilter !== "ALL" && c.dietary_preference !== dietFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [customers, dietFilter, searchQuery]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Heart className="w-6 h-6 text-[#FF6A00]" />
            Guest Profiles &amp; VIP Loyalty
          </h1>
          <p className="text-sm text-muted-foreground">
            Consent-verified guest preferences, allergies, visit history, and dietary tags (H-13,
            H-24).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCustomers} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#FF6A00]/90 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Guest Profile
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border">
        <div className="relative flex-1 sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, phone or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {["ALL", "VEG", "NON_VEG", "JAIN", "VEGAN"].map((d) => (
            <button
              key={d}
              onClick={() => setDietFilter(d)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                dietFilter === d
                  ? "bg-[#0B1F3B] text-white border-[#0B1F3B] dark:bg-white dark:text-[#0B1F3B]"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3">Guest Name</th>
                <th className="px-4 py-3">Phone / Contact</th>
                <th className="px-4 py-3">Diet &amp; Allergies</th>
                <th className="px-4 py-3">Special Preferences</th>
                <th className="px-4 py-3 text-right">Visits</th>
                <th className="px-4 py-3 text-right">Total Spend</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Loading guest directory...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No guest profiles found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      <div className="flex items-center gap-1.5">
                        {c.name}
                        {c.consent_given && (
                          <span title="Explicit Consent Given">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          </span>
                        )}
                      </div>
                      {c.email && (
                        <span className="text-[11px] text-muted-foreground block">{c.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{c.phone}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {c.dietary_preference !== "NONE" && (
                          <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold text-[10px]">
                            {c.dietary_preference}
                          </span>
                        )}
                        {c.allergies && (
                          <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-medium text-[10px] border border-red-200 dark:border-red-900">
                            Allergic: {c.allergies}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                      {c.notes || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground text-right">
                      {c.visit_count}
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground text-right">
                      {formatRupees(c.total_spend_paise)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(c)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Guest Profile" : "Register New Guest Profile"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCustomer} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Anand Sundaram"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="anand@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Dietary Preference
                </label>
                <select
                  value={dietaryPreference}
                  onChange={(e) =>
                    setDietaryPreference(e.target.value as Customer["dietary_preference"])
                  }
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                >
                  <option value="NONE">No Preference</option>
                  <option value="VEG">Vegetarian</option>
                  <option value="NON_VEG">Non-Vegetarian</option>
                  <option value="EGG">Eggetarian</option>
                  <option value="JAIN">Jain</option>
                  <option value="VEGAN">Vegan</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Allergies (if any)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Peanuts, Gluten"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Preferences &amp; Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Prefers quiet booth, extra spicy sambar"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="rounded border-border text-[#FF6A00] focus:ring-[#FF6A00]"
              />
              <span>
                Explicit consent obtained from guest to retain profile &amp; visit history
              </span>
            </label>

            <div className="pt-3 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#FF6A00]/90 font-semibold"
              >
                {isSaving ? "Saving..." : editingId ? "Update Profile" : "Save Profile"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
