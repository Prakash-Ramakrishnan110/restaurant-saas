import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Truck,
  Plus,
  RefreshCw,
  CheckCircle2,
  PackageCheck,
  Search,
  Building2,
  Trash2,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees, parseRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";

export interface SupplierItem {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  is_active: boolean;
}

export interface PurchaseOrderItemData {
  id?: string;
  ingredient: string;
  ingredient_name?: string;
  ingredient_unit?: string;
  quantity: string;
  unit_price_paise: number;
  subtotal_paise: number;
  batch_number?: string;
  expiry_date?: string;
}

export interface PurchaseOrderData {
  id: string;
  order_number: string;
  supplier?: string;
  supplier_name?: string;
  status: "DRAFT" | "RECEIVED" | "CANCELLED";
  invoice_number?: string;
  total_cost_paise: number;
  notes?: string;
  received_at?: string;
  items: PurchaseOrderItemData[];
  created_at: string;
}

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  cost_paise: number;
}

export const SuppliersPurchasesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"PURCHASES" | "SUPPLIERS">("PURCHASES");
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderData[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // New PO Modal state
  const [showPOModal, setShowPOModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [poItems, setPoItems] = useState<
    { ingredient: string; quantity: string; unitPriceRupees: string; batchNumber: string }[]
  >([]);
  const [isSubmittingPO, setIsSubmittingPO] = useState(false);

  // New Supplier Modal state
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierGstin, setSupplierGstin] = useState("");
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [poRes, supRes, ingRes] = await Promise.all([
        apiClient.get<ListResponse<PurchaseOrderData>>("/api/v1/inventory/purchases/"),
        apiClient.get<ListResponse<SupplierItem>>("/api/v1/inventory/suppliers/"),
        apiClient.get<ListResponse<IngredientOption>>("/api/v1/inventory/ingredients/"),
      ]);
      setPurchaseOrders(unwrapList(poRes.data));
      setSuppliers(unwrapList(supRes.data));
      setIngredients(unwrapList(ingRes.data));
    } catch {
      setError("Failed to load purchase orders and vendor directory.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openNewPOModal = () => {
    setSelectedSupplier(suppliers[0]?.id || "");
    setOrderNumber(`PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setInvoiceNumber("");
    setPoItems([
      {
        ingredient: ingredients[0]?.id || "",
        quantity: "10.000",
        unitPriceRupees: ingredients[0] ? (ingredients[0].cost_paise / 100).toFixed(2) : "100.00",
        batchNumber: "",
      },
    ]);
    setShowPOModal(true);
  };

  const handleAddPoItemRow = () => {
    const first = ingredients[0];
    setPoItems((prev) => [
      ...prev,
      {
        ingredient: first?.id || "",
        quantity: "5.000",
        unitPriceRupees: first ? (first.cost_paise / 100).toFixed(2) : "100.00",
        batchNumber: "",
      },
    ]);
  };

  const handleRemovePoItemRow = (idx: number) => {
    setPoItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePoItemChange = (
    idx: number,
    field: "ingredient" | "quantity" | "unitPriceRupees" | "batchNumber",
    val: string
  ) => {
    setPoItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (field === "ingredient") {
          const ing = ingredients.find((ing) => ing.id === val);
          const defaultPrice = ing ? (ing.cost_paise / 100).toFixed(2) : item.unitPriceRupees;
          return { ...item, ingredient: val, unitPriceRupees: defaultPrice };
        }
        return { ...item, [field]: val };
      })
    );
  };

  const handleReceivePO = async (poId: string) => {
    try {
      await apiClient.post(`/api/v1/inventory/purchases/${poId}/receive/`);
      await fetchData();
    } catch {
      setError("Failed to receive and stock purchase order.");
    }
  };

  const handlePOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber || poItems.length === 0) return;
    setIsSubmittingPO(true);
    try {
      const itemsPayload = poItems.map((item) => ({
        ingredient: item.ingredient,
        quantity: item.quantity,
        unit_price_paise: parseRupees(item.unitPriceRupees),
        batch_number: item.batchNumber,
      }));

      await apiClient.post("/api/v1/inventory/purchases/", {
        order_number: orderNumber,
        supplier: selectedSupplier || null,
        invoice_number: invoiceNumber,
        items: itemsPayload,
      });

      setShowPOModal(false);
      await fetchData();
    } catch {
      setError("Failed to record new purchase order.");
    } finally {
      setIsSubmittingPO(false);
    }
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName) return;
    setIsSubmittingSupplier(true);
    try {
      await apiClient.post("/api/v1/inventory/suppliers/", {
        name: supplierName,
        contact_person: contactPerson,
        phone: supplierPhone,
        email: supplierEmail,
        address: supplierAddress,
        gstin: supplierGstin,
      });
      setShowSupplierModal(false);
      setSupplierName("");
      setContactPerson("");
      setSupplierPhone("");
      setSupplierEmail("");
      setSupplierAddress("");
      setSupplierGstin("");
      await fetchData();
    } catch {
      setError("Failed to register supplier.");
    } finally {
      setIsSubmittingSupplier(false);
    }
  };

  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter(
      (po) =>
        po.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (po.supplier_name && po.supplier_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (po.invoice_number && po.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [purchaseOrders, searchQuery]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.contact_person && s.contact_person.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.phone && s.phone.includes(searchQuery))
    );
  }, [suppliers, searchQuery]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-600" />
            Purchases & Supplier Directory
            <span className="text-sm font-normal text-gray-500 font-tamil">
              (கொள்முதல் & விநியோகஸ்தர்கள்)
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Vendor records, inward stock orders, batch reception, and weighted average cost tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {activeTab === "PURCHASES" ? (
            <Button
              size="sm"
              onClick={openNewPOModal}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="w-4 h-4" />
              New Purchase Order
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setShowSupplierModal(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("PURCHASES")}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 ${
            activeTab === "PURCHASES"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          Inward Purchase Orders ({purchaseOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("SUPPLIERS")}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 ${
            activeTab === "SUPPLIERS"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Suppliers Directory ({suppliers.length})
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={
            activeTab === "PURCHASES"
              ? "Search by PO number, supplier, or invoice..."
              : "Search suppliers by name, contact, or phone..."
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm focus:outline-none"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tab 1: Purchase Orders Table */}
      {activeTab === "PURCHASES" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      Loading purchase orders...
                    </td>
                  </tr>
                ) : filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No purchase orders found. Click "New Purchase Order" to record an inward
                      delivery.
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {po.order_number}
                        <div className="text-xs text-gray-400 font-normal">
                          {new Date(po.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {po.supplier_name || "Direct Cash Purchase"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {po.invoice_number || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {po.items.length} line item(s)
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {formatRupees(po.total_cost_paise)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {po.status === "RECEIVED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Stocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            Draft Order
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {po.status === "DRAFT" && (
                          <Button
                            size="sm"
                            onClick={() => handleReceivePO(po.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 ml-auto"
                          >
                            Receive & Stock
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Suppliers Directory */}
      {activeTab === "SUPPLIERS" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Vendor / Supplier</th>
                  <th className="px-4 py-3">Contact Person</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">GSTIN / Tax ID</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      Loading vendor directory...
                    </td>
                  </tr>
                ) : filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No suppliers registered. Click "Add Supplier" to create your first vendor
                      contact.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {sup.name}
                        {sup.address && (
                          <div className="text-xs text-gray-400 font-normal">{sup.address}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-800">{sup.contact_person || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{sup.phone || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{sup.email || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {sup.gstin || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Purchase Order Modal */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4 my-8">
            <h3 className="text-lg font-bold text-gray-900">Record Inward Purchase Delivery</h3>
            <form onSubmit={handlePOSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">PO Number</label>
                  <input
                    type="text"
                    required
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Supplier / Vendor
                  </label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Direct Cash Purchase</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Vendor Invoice #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9021"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase text-gray-700">
                    Received Goods
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddPoItemRow}
                    className="text-xs h-7 text-emerald-700"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto p-1">
                  {poItems.map((item, idx) => {
                    const ing = ingredients.find((i) => i.id === item.ingredient);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={item.ingredient}
                          onChange={(e) => handlePoItemChange(idx, "ingredient", e.target.value)}
                          className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                        >
                          {ingredients.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                        <div className="w-24">
                          <input
                            type="number"
                            step="0.001"
                            required
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => handlePoItemChange(idx, "quantity", e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
                          />
                        </div>
                        <div className="w-24">
                          <input
                            type="text"
                            required
                            placeholder="Unit ₹"
                            value={item.unitPriceRupees}
                            onChange={(e) =>
                              handlePoItemChange(idx, "unitPriceRupees", e.target.value)
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
                          />
                        </div>
                        <div className="w-28">
                          <input
                            type="text"
                            placeholder="Batch #"
                            value={item.batchNumber}
                            onChange={(e) => handlePoItemChange(idx, "batchNumber", e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-10">{ing?.unit || ""}</span>
                        {poItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePoItemRow(idx)}
                            className="text-red-500 hover:text-red-700 p-1 h-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPOModal(false)}
                  disabled={isSubmittingPO}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingPO}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmittingPO ? "Saving..." : "Create Order"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Add Vendor / Supplier</h3>
            <form onSubmit={handleSupplierSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Company / Vendor Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Cash & Carry"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="Ramesh Kumar"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="metro@supplies.com"
                    value={supplierEmail}
                    onChange={(e) => setSupplierEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    placeholder="33AAAAA0000A1Z5"
                    value={supplierGstin}
                    onChange={(e) => setSupplierGstin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Physical Address
                </label>
                <input
                  type="text"
                  placeholder="Koyambedu Wholesale Market, Chennai"
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSupplierModal(false)}
                  disabled={isSubmittingSupplier}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingSupplier}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmittingSupplier ? "Saving..." : "Save Supplier"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default SuppliersPurchasesPage;
