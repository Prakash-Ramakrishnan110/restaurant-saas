import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRight,
  Building2,
  Users,
  Plus,
  Pencil,
  Tent,
  BellRing,
  Bed,
  Sparkles,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Skeleton } from "../../components/ui/skeleton";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees } from "../../utils/currency";

export interface PlanRecord {
  id: string;
  name: string;
  slug: string;
  price_paise: number;
  entitlements: {
    max_branches?: number;
    max_service_areas?: number;
    max_tables?: number;
    max_menu_items?: number;
    floor_editor?: boolean;
    table_merge?: boolean;
    courses?: boolean;
    reports?: boolean;
    allows_huts?: boolean;
    allows_waiter_call?: boolean;
    allows_minimum_spend?: boolean;
    outdoor_sections?: boolean;
    allows_room_service?: boolean;
    allows_room_folio?: boolean;
    housekeeping_tracking?: boolean;
    [key: string]: unknown;
  };
  is_active: boolean;
}

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  plan_name?: string;
  status: string;
}

export const PlatformPlansPage: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanRecord | null>(null);

  // Plan Builder / Editor Dialog state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formPriceRupees, setFormPriceRupees] = useState(2999);
  const [formMaxBranches, setFormMaxBranches] = useState(3);
  const [formMaxTables, setFormMaxTables] = useState(35);
  const [formMaxServiceAreas, setFormMaxServiceAreas] = useState(4);
  const [formMaxMenuItems, setFormMaxMenuItems] = useState(250);

  // Feature Toggles
  const [formAllowsHuts, setFormAllowsHuts] = useState(false);
  const [formAllowsWaiterCall, setFormAllowsWaiterCall] = useState(false);
  const [formAllowsMinSpend, setFormAllowsMinSpend] = useState(false);
  const [formOutdoorSections, setFormOutdoorSections] = useState(false);
  const [formAllowsRoomService, setFormAllowsRoomService] = useState(false);
  const [formAllowsRoomFolio, setFormAllowsRoomFolio] = useState(false);
  const [formHousekeeping, setFormHousekeeping] = useState(false);
  const [formFloorEditor, setFormFloorEditor] = useState(true);
  const [formTableMerge, setFormTableMerge] = useState(true);
  const [formCourses, setFormCourses] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormName("");
    setFormSlug("");
    setFormPriceRupees(2999);
    setFormMaxBranches(3);
    setFormMaxTables(35);
    setFormMaxServiceAreas(4);
    setFormMaxMenuItems(250);
    setFormAllowsHuts(false);
    setFormAllowsWaiterCall(false);
    setFormAllowsMinSpend(false);
    setFormOutdoorSections(false);
    setFormAllowsRoomService(false);
    setFormAllowsRoomFolio(false);
    setFormHousekeeping(false);
    setFormFloorEditor(true);
    setFormTableMerge(true);
    setFormCourses(false);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (p: PlanRecord) => {
    setEditingPlan(p);
    setFormName(p.name);
    setFormSlug(p.slug);
    setFormPriceRupees(Math.round(p.price_paise / 100));
    setFormMaxBranches(p.entitlements.max_branches ?? 1);
    setFormMaxTables(p.entitlements.max_tables ?? 15);
    setFormMaxServiceAreas(p.entitlements.max_service_areas ?? 1);
    setFormMaxMenuItems(p.entitlements.max_menu_items ?? 100);
    setFormAllowsHuts(!!p.entitlements.allows_huts);
    setFormAllowsWaiterCall(!!p.entitlements.allows_waiter_call);
    setFormAllowsMinSpend(!!p.entitlements.allows_minimum_spend);
    setFormOutdoorSections(!!p.entitlements.outdoor_sections);
    setFormAllowsRoomService(!!p.entitlements.allows_room_service);
    setFormAllowsRoomFolio(!!p.entitlements.allows_room_folio);
    setFormHousekeeping(!!p.entitlements.housekeeping_tracking);
    setFormFloorEditor(!!p.entitlements.floor_editor);
    setFormTableMerge(!!p.entitlements.table_merge);
    setFormCourses(!!p.entitlements.courses);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const getUniqueSlug = (baseSlug: string) => {
    let candidate = baseSlug;
    let counter = 2;
    while (plans.some((p) => p.slug === candidate)) {
      candidate = `${baseSlug}-${counter}`;
      counter++;
    }
    return candidate;
  };

  const getUniqueName = (baseName: string) => {
    let candidate = baseName;
    let counter = 2;
    while (plans.some((p) => p.name.toLowerCase() === candidate.toLowerCase())) {
      candidate = `${baseName} ${counter}`;
      counter++;
    }
    return candidate;
  };

  const applyBlueprint = (type: "dhaba" | "hotel" | "dining" | "qsr") => {
    if (type === "dhaba") {
      setFormName(
        editingPlan ? "Dhaba & Outdoor Huts Edition" : getUniqueName("Dhaba & Outdoor Huts Edition")
      );
      if (!editingPlan) setFormSlug(getUniqueSlug("dhaba-huts"));
      setFormPriceRupees(2999);
      setFormMaxBranches(3);
      setFormMaxTables(35);
      setFormMaxServiceAreas(4);
      setFormMaxMenuItems(250);
      setFormAllowsHuts(true);
      setFormAllowsWaiterCall(true);
      setFormAllowsMinSpend(true);
      setFormOutdoorSections(true);
      setFormAllowsRoomService(false);
      setFormAllowsRoomFolio(false);
      setFormHousekeeping(false);
      setFormFloorEditor(true);
      setFormTableMerge(true);
      setFormCourses(false);
    } else if (type === "hotel") {
      setFormName(editingPlan ? "Hotel & Resort Edition" : getUniqueName("Hotel & Resort Edition"));
      if (!editingPlan) setFormSlug(getUniqueSlug("hotel-resort"));
      setFormPriceRupees(4999);
      setFormMaxBranches(5);
      setFormMaxTables(100);
      setFormMaxServiceAreas(6);
      setFormMaxMenuItems(500);
      setFormAllowsHuts(false);
      setFormAllowsWaiterCall(true);
      setFormAllowsMinSpend(false);
      setFormOutdoorSections(true);
      setFormAllowsRoomService(true);
      setFormAllowsRoomFolio(true);
      setFormHousekeeping(true);
      setFormFloorEditor(true);
      setFormTableMerge(true);
      setFormCourses(true);
    } else if (type === "dining") {
      setFormName(editingPlan ? "Casual Dining Edition" : getUniqueName("Casual Dining Edition"));
      if (!editingPlan) setFormSlug(getUniqueSlug("casual-dining"));
      setFormPriceRupees(1999);
      setFormMaxBranches(2);
      setFormMaxTables(50);
      setFormMaxServiceAreas(2);
      setFormMaxMenuItems(200);
      setFormAllowsHuts(false);
      setFormAllowsWaiterCall(false);
      setFormAllowsMinSpend(false);
      setFormOutdoorSections(false);
      setFormAllowsRoomService(false);
      setFormAllowsRoomFolio(false);
      setFormHousekeeping(false);
      setFormFloorEditor(true);
      setFormTableMerge(true);
      setFormCourses(false);
    } else if (type === "qsr") {
      setFormName(
        editingPlan ? "Express Counter Edition" : getUniqueName("Express Counter Edition")
      );
      if (!editingPlan) setFormSlug(getUniqueSlug("express-counter"));
      setFormPriceRupees(999);
      setFormMaxBranches(1);
      setFormMaxTables(0);
      setFormMaxServiceAreas(1);
      setFormMaxMenuItems(100);
      setFormAllowsHuts(false);
      setFormAllowsWaiterCall(false);
      setFormAllowsMinSpend(false);
      setFormOutdoorSections(false);
      setFormAllowsRoomService(false);
      setFormAllowsRoomFolio(false);
      setFormHousekeeping(false);
      setFormFloorEditor(false);
      setFormTableMerge(false);
      setFormCourses(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setIsSaving(true);
    setFormError(null);

    const payload = {
      name: formName.trim(),
      slug: formSlug.trim() || undefined,
      price_paise: Math.round(formPriceRupees * 100),
      is_active: true,
      entitlements: {
        max_branches: formMaxBranches,
        max_tables: formMaxTables,
        max_service_areas: formMaxServiceAreas,
        max_menu_items: formMaxMenuItems,
        allows_huts: formAllowsHuts,
        allows_waiter_call: formAllowsWaiterCall,
        allows_minimum_spend: formAllowsMinSpend,
        outdoor_sections: formOutdoorSections,
        allows_room_service: formAllowsRoomService,
        allows_room_folio: formAllowsRoomFolio,
        housekeeping_tracking: formHousekeeping,
        floor_editor: formFloorEditor,
        table_merge: formTableMerge,
        courses: formCourses,
      },
    };

    try {
      if (editingPlan) {
        await apiClient.patch(`/plans/${editingPlan.id}/`, payload);
      } else {
        await apiClient.post("/plans/", payload);
      }
      setIsEditorOpen(false);
      await fetchPlansAndTenants();
    } catch (err: any) {
      const errorMsg =
        err.error?.message ||
        err.response?.data?.error?.message ||
        err.message ||
        "Failed to save plan.";
      setFormError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchPlansAndTenants = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [plansRes, tenantsRes] = await Promise.allSettled([
        apiClient.get<PlanRecord[]>("/plans/"),
        apiClient.get<ListResponse<TenantItem> | TenantItem[]>("/tenants/"),
      ]);

      if (plansRes.status === "fulfilled") {
        setPlans(plansRes.value.data);
      } else {
        setError("Failed to load platform subscription plans.");
      }

      if (tenantsRes.status === "fulfilled") {
        setTenants(unwrapList<TenantItem>(tenantsRes.value.data));
      }
    } catch {
      setError("Failed to load platform subscription plans.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlansAndTenants();
  }, []);

  // Tenants subscribed to the currently selected plan
  const subscribedTenants = useMemo(() => {
    if (!selectedPlan) return [];
    return tenants.filter((t) => {
      const planName = (t.plan_name || "").toLowerCase();
      const planSlug = selectedPlan.slug.toLowerCase();
      const planTitle = selectedPlan.name.toLowerCase();
      return (
        planName === planSlug ||
        planName === planTitle ||
        planName.includes(planSlug) ||
        planTitle.includes(planName)
      );
    });
  }, [selectedPlan, tenants]);

  const getSubscribersCount = (plan: PlanRecord) => {
    return tenants.filter((t) => {
      const planName = (t.plan_name || "").toLowerCase();
      const planSlug = plan.slug.toLowerCase();
      const planTitle = plan.name.toLowerCase();
      return (
        planName === planSlug ||
        planName === planTitle ||
        planName.includes(planSlug) ||
        planTitle.includes(planName)
      );
    }).length;
  };

  const formatQuota = (val: number | undefined) => {
    if (val === undefined || val === null) return "Unlimited";
    if (val === -1) return "Unlimited";
    return val.toString();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
            Tier Management &amp; Entitlements
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground mt-0.5 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-[#FF6A00]" />
            SaaS Subscription Plans
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Compact pricing cards with operational quotas and feature entitlements. Click any plan
            card to inspect full details.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPlansAndTenants}
            disabled={isLoading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <Button
            size="sm"
            onClick={openCreateModal}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Plan
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/admin/tenants/new")}
            className="text-xs bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-[#0B1F3B] font-bold gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Customer
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Compact Plans Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-xs">
          No active subscription plans found.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const isPopular = p.slug.includes("pro") || p.slug.includes("business");
            const subCount = getSubscribersCount(p);

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPlan(p)}
                className={`group relative p-4 rounded-xl border bg-card cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] flex flex-col justify-between ${
                  isPopular
                    ? "border-[#FF6A00] ring-1 ring-[#FF6A00]/40 shadow-xs"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-2.5 right-4 px-2 py-0.5 bg-[#FF6A00] text-[#0B1F3B] text-[10px] font-black uppercase tracking-wider rounded-full shadow-xs">
                    Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h2 className="text-base font-extrabold text-foreground group-hover:text-[#FF6A00] transition-colors">
                      {p.name}
                    </h2>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono uppercase bg-muted/30"
                    >
                      {p.slug}
                    </Badge>
                  </div>

                  <div className="mt-2 mb-3">
                    <span className="text-2xl font-black text-foreground">
                      {formatRupees(p.price_paise)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1 font-medium">/ month</span>
                  </div>

                  {/* Compact Quick Limits & Feature Highlights */}
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span className="px-2 py-0.5 rounded bg-muted font-semibold">
                      {formatQuota(p.entitlements.max_branches)} outlet(s)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-muted font-semibold">
                      {formatQuota(p.entitlements.max_tables)} units/tables
                    </span>
                    {p.entitlements.allows_huts && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold flex items-center gap-1">
                        <Tent className="w-3 h-3" /> Dhaba Huts
                      </span>
                    )}
                    {p.entitlements.allows_waiter_call && (
                      <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 font-semibold flex items-center gap-1">
                        <BellRing className="w-3 h-3" /> Waiter Bell
                      </span>
                    )}
                    {(p.entitlements.allows_room_service || p.entitlements.allows_room_folio) && (
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold flex items-center gap-1">
                        <Bed className="w-3 h-3" /> Hotel Rooms
                      </span>
                    )}
                    {p.entitlements.floor_editor && (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                        Visual Floor Plan Editor
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    {subCount} {subCount === 1 ? "Brand" : "Brands"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(p);
                      }}
                      className="text-xs text-muted-foreground hover:text-[#FF6A00] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                      title="Edit Plan Settings"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <span className="text-[#FF6A00] font-bold text-[11px] group-hover:underline flex items-center gap-0.5">
                      Details <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Entitlements Modal Dialog */}
      <Dialog open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        {selectedPlan && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto font-sans">
            <DialogHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
                    Tier Entitlements &amp; Operational Quotas
                  </span>
                  <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-2 mt-0.5">
                    {selectedPlan.name}
                    <Badge variant="outline" className="text-xs font-mono uppercase">
                      {selectedPlan.slug}
                    </Badge>
                  </DialogTitle>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-foreground">
                    {formatRupees(selectedPlan.price_paise)}
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    per month (billed monthly)
                  </span>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Quotas Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Operational Limits &amp; Quotas
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">Max Outlets</span>
                    <span className="text-lg font-black text-foreground mt-0.5 block">
                      {formatQuota(selectedPlan.entitlements.max_branches)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">Dining Tables</span>
                    <span className="text-lg font-black text-foreground mt-0.5 block">
                      {formatQuota(selectedPlan.entitlements.max_tables)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">Service Areas</span>
                    <span className="text-lg font-black text-foreground mt-0.5 block">
                      {formatQuota(selectedPlan.entitlements.max_service_areas)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">Menu Dishes</span>
                    <span className="text-lg font-black text-foreground mt-0.5 block">
                      {formatQuota(selectedPlan.entitlements.max_menu_items)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Feature Flags & Capabilities */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Platform Feature Entitlements
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    {
                      label: "Dhaba Huts & Gazebos",
                      enabled: !!selectedPlan.entitlements.allows_huts,
                      desc: "Hut, cottage, gazebo, and cabana units with private ordering",
                    },
                    {
                      label: "QR Waiter Call Bell",
                      enabled: !!selectedPlan.entitlements.allows_waiter_call,
                      desc: "Guest mobile buzzer to call waiter or request water to hut/table",
                    },
                    {
                      label: "Hut Minimum Spend Rules",
                      enabled: !!selectedPlan.entitlements.allows_minimum_spend,
                      desc: "Enforce minimum billing requirement for VIP private huts",
                    },
                    {
                      label: "Outdoor Lawns & Sections",
                      enabled: !!selectedPlan.entitlements.outdoor_sections,
                      desc: "Dedicated lawn, garden hut, and open-air service areas",
                    },
                    {
                      label: "In-Room Dining Service",
                      enabled: !!selectedPlan.entitlements.allows_room_service,
                      desc: "Hotel room delivery orders with guest room identification",
                    },
                    {
                      label: "Room Folio Billing",
                      enabled: !!selectedPlan.entitlements.allows_room_folio,
                      desc: "Transfer dining bill directly to hotel room folio check-in tab",
                    },
                    {
                      label: "Housekeeping Tracking",
                      enabled: !!selectedPlan.entitlements.housekeeping_tracking,
                      desc: "Clean/dirty turnover status tracking for rooms and huts",
                    },
                    {
                      label: "Visual Floor Plan Editor",
                      enabled: !!selectedPlan.entitlements.floor_editor,
                      desc: "Drag-and-drop table layouts and section mapping",
                    },
                    {
                      label: "Dynamic Table Merging",
                      enabled: !!selectedPlan.entitlements.table_merge,
                      desc: "Combine adjacent tables for large party guest seating",
                    },
                    {
                      label: "Multi-Course Pacing (KOT)",
                      enabled: !!selectedPlan.entitlements.courses,
                      desc: "Appetizer, Main, Dessert staged fire tickets",
                    },
                    {
                      label: "Kitchen Station Routing (KDS)",
                      enabled: true,
                      desc: "Direct ticket dispatch to hot kitchen, pantry, and bar",
                    },
                    {
                      label: "QR Dine-In Mobile Ordering",
                      enabled: true,
                      desc: "Guest mobile menu browsing, ordering, and self-service",
                    },
                  ].map((feat) => (
                    <div
                      key={feat.label}
                      className="p-2.5 rounded-lg border border-border bg-card flex items-start gap-2.5"
                    >
                      {feat.enabled ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <span
                          className={`font-bold block ${
                            feat.enabled ? "text-foreground" : "text-muted-foreground line-through"
                          }`}
                        >
                          {feat.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-tight">
                          {feat.desc}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subscribed Brands on this tier */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Subscribed Brands ({subscribedTenants.length})
                  </h3>
                  <span className="text-[11px] text-muted-foreground">Active venue chains</span>
                </div>

                {subscribedTenants.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 rounded-lg border border-dashed border-border text-center">
                    No active restaurant brands currently subscribed to this plan.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {subscribedTenants.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedPlan(null);
                          navigate(`/admin/tenants/${t.id}`);
                        }}
                        className="p-2 rounded-md border border-border bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-[#FF6A00]" />
                          <span className="font-bold text-foreground">{t.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({t.business_type})
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {t.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setSelectedPlan(null)}>
                  Close
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const p = selectedPlan;
                      setSelectedPlan(null);
                      openEditModal(p);
                    }}
                    className="text-xs gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit This Plan
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedPlan(null);
                      navigate("/admin/tenants/new");
                    }}
                    className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-[#0B1F3B] font-bold text-xs gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Provision Customer
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Plan Builder / Editor Modal */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto font-sans">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FF6A00]" />
              {editingPlan ? `Edit Plan: ${editingPlan.name}` : "Create New Subscription Plan"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Configure operational quotas and feature entitlement toggles for Dhabas, Hotels, or
              Dining.
            </p>
          </DialogHeader>

          {/* 1-Click Blueprints */}
          <div className="pt-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
              1-Click Industry Blueprints
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyBlueprint("dhaba")}
                className="p-2.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 text-left transition-colors"
              >
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Tent className="w-3.5 h-3.5 text-amber-600" /> Dhaba &amp; Huts
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  ₹2,999/mo • Huts + Buzzer
                </span>
              </button>

              <button
                type="button"
                onClick={() => applyBlueprint("hotel")}
                className="p-2.5 rounded-lg border border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100/60 dark:hover:bg-purple-950/40 text-left transition-colors"
              >
                <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <Bed className="w-3.5 h-3.5 text-purple-600" /> Hotel &amp; Resort
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  ₹4,999/mo • Rooms + Folio
                </span>
              </button>

              <button
                type="button"
                onClick={() => applyBlueprint("dining")}
                className="p-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 text-left transition-colors"
              >
                <span className="text-xs font-bold text-foreground block">Casual Dining</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  ₹1,999/mo • 50 Tables + Floor
                </span>
              </button>

              <button
                type="button"
                onClick={() => applyBlueprint("qsr")}
                className="p-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 text-left transition-colors"
              >
                <span className="text-xs font-bold text-foreground block">Express Counter</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  ₹999/mo • 1 Outlet + Token
                </span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSavePlan} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
                {formError}
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Plan Display Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Dhaba & Outdoor Huts Edition"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-[#FF6A00]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Slug Identifier</label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g. dhaba-huts"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-background font-mono focus:outline-none focus:ring-1 focus:ring-[#FF6A00]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">Monthly Price (₹ INR)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={formPriceRupees}
                  onChange={(e) => setFormPriceRupees(Number(e.target.value))}
                  className="w-full text-xs pl-7 pr-3 py-2 rounded-lg border border-input bg-background font-bold focus:outline-none focus:ring-1 focus:ring-[#FF6A00]"
                />
              </div>
            </div>

            {/* Quotas */}
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                Operational Limits &amp; Quotas (-1 for unlimited)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">
                    Max Outlets
                  </label>
                  <input
                    type="number"
                    value={formMaxBranches}
                    onChange={(e) => setFormMaxBranches(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-input bg-background font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">
                    Max Tables / Rooms
                  </label>
                  <input
                    type="number"
                    value={formMaxTables}
                    onChange={(e) => setFormMaxTables(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-input bg-background font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">
                    Max Service Areas
                  </label>
                  <input
                    type="number"
                    value={formMaxServiceAreas}
                    onChange={(e) => setFormMaxServiceAreas(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-input bg-background font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">
                    Max Menu Items
                  </label>
                  <input
                    type="number"
                    value={formMaxMenuItems}
                    onChange={(e) => setFormMaxMenuItems(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-input bg-background font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Feature Checkbox Sections */}
            <div className="space-y-3 pt-2">
              {/* Dhaba Section */}
              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/10 space-y-2">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Tent className="w-4 h-4 text-amber-600" /> Dhaba &amp; Outdoor Hut Features
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAllowsHuts}
                      onChange={(e) => setFormAllowsHuts(e.target.checked)}
                      className="rounded border-input text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      <strong>Dhaba Huts &amp; Cabanas</strong> (HUT/CABANA units)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAllowsWaiterCall}
                      onChange={(e) => setFormAllowsWaiterCall(e.target.checked)}
                      className="rounded border-input text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      <strong>Waiter Call Bell</strong> (QR digital buzzer)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAllowsMinSpend}
                      onChange={(e) => setFormAllowsMinSpend(e.target.checked)}
                      className="rounded border-input text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      <strong>Minimum Order Spend</strong> (VIP hut rule)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formOutdoorSections}
                      onChange={(e) => setFormOutdoorSections(e.target.checked)}
                      className="rounded border-input text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      <strong>Outdoor Lawns &amp; Zones</strong>
                    </span>
                  </label>
                </div>
              </div>

              {/* Hotel Section */}
              <div className="p-3 rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/30 dark:bg-purple-950/10 space-y-2">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <Bed className="w-4 h-4 text-purple-600" /> Hotel &amp; Resort Room Features
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAllowsRoomService}
                      onChange={(e) => setFormAllowsRoomService(e.target.checked)}
                      className="rounded border-input text-purple-600 focus:ring-purple-500"
                    />
                    <span>
                      <strong>In-Room Dining</strong> (Room food delivery)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAllowsRoomFolio}
                      onChange={(e) => setFormAllowsRoomFolio(e.target.checked)}
                      className="rounded border-input text-purple-600 focus:ring-purple-500"
                    />
                    <span>
                      <strong>Room Folio Billing</strong> (Post to room tab)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formHousekeeping}
                      onChange={(e) => setFormHousekeeping(e.target.checked)}
                      className="rounded border-input text-purple-600 focus:ring-purple-500"
                    />
                    <span>
                      <strong>Housekeeping Turnover</strong> (Clean/Dirty)
                    </span>
                  </label>
                </div>
              </div>

              {/* Dining & Floor Section */}
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                <span className="text-xs font-bold text-foreground">
                  Floor Plan &amp; Kitchen Workflow
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formFloorEditor}
                      onChange={(e) => setFormFloorEditor(e.target.checked)}
                      className="rounded border-input text-[#FF6A00] focus:ring-[#FF6A00]"
                    />
                    <span>Visual Floor Plan</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formTableMerge}
                      onChange={(e) => setFormTableMerge(e.target.checked)}
                      className="rounded border-input text-[#FF6A00] focus:ring-[#FF6A00]"
                    />
                    <span>Table Merging</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCourses}
                      onChange={(e) => setFormCourses(e.target.checked)}
                      className="rounded border-input text-[#FF6A00] focus:ring-[#FF6A00]"
                    />
                    <span>Course Pacing (KOT)</span>
                  </label>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditorOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-[#0B1F3B] font-bold text-xs gap-1.5"
              >
                {isSaving ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
