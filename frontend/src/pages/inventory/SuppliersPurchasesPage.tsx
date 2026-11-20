import React, { useState, useEffect, useCallback } from "react";
import { Building2, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";

interface SupplierRow {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
}

export const SuppliersPurchasesPage: React.FC = () => {
  const { can } = useAuth();
  const canManage = can("inventory.manage");

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await apiClient.get<ListResponse<SupplierRow>>("/inventory/suppliers/");
      setSuppliers(unwrapList(res.data));
    } catch {
      setError("Failed to load suppliers.");
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/inventory/suppliers/", {
        name: name.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      setName("");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setNotice("Supplier added.");
      await fetchSuppliers();
    } catch {
      setError("Could not add supplier.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[#FF6A00]" />
          <span>Suppliers &amp; Orders</span>
          <span className="text-xs text-muted-foreground font-normal">சப்ளையர்கள்</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your regular vendors and contacts for receiving stock.
        </p>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {canManage && (
        <form
          onSubmit={handleAddSupplier}
          className="p-5 rounded-xl border border-border bg-card grid grid-cols-1 md:grid-cols-5 gap-3"
        >
          <input
            required
            placeholder="Supplier Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
          <input
            placeholder="Contact Person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
          <input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Supplier
          </Button>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Supplier</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td className="p-3 font-bold">{s.name}</td>
                <td className="p-3 text-xs">{s.contact_person || "—"}</td>
                <td className="p-3 text-xs font-mono">{s.phone || "—"}</td>
                <td className="p-3 text-xs">{s.email || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
