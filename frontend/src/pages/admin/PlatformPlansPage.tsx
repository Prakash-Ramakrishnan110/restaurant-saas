import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CreditCard, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { apiClient } from "../../api/client";
import { formatRupees } from "../../utils/currency";

interface PlanRecord {
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
  };
  is_active: boolean;
}

export const PlatformPlansPage: React.FC = () => {
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<PlanRecord[]>("/plans/");
      setPlans(res.data);
    } catch {
      setError("Failed to load platform subscription plans.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            SaaS Subscription Plans{" "}
            <span className="text-xs text-muted-foreground font-normal">திட்டங்கள்</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage multi-tenant pricing tiers, operational limits, and feature entitlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/admin/tenants">
            <Button variant="outline" size="sm">
              Customers Directory
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={fetchPlans} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {/* Plans Comparison Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No active subscription plans found.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => {
            const isPopular = p.slug.includes("pro") || p.slug.includes("business");
            return (
              <Card
                key={p.id}
                className={`relative flex flex-col justify-between shadow-sm border ${
                  isPopular ? "border-primary ring-1 ring-primary shadow-md" : ""
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider rounded-full">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg font-black text-foreground">{p.name}</CardTitle>
                  <CardDescription className="font-mono text-xs text-muted-foreground">
                    Tier: {p.slug}
                  </CardDescription>
                  <div className="mt-4">
                    <span className="text-3xl font-black text-foreground">
                      {formatRupees(p.price_paise)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">/ month</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  <div className="border-t pt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Max Outlets / Branches:</span>
                      <span className="font-bold text-foreground">
                        {p.entitlements.max_branches ?? "Unlimited"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Max Dining Tables:</span>
                      <span className="font-bold text-foreground">
                        {p.entitlements.max_tables ?? "Unlimited"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Max Menu Dishes:</span>
                      <span className="font-bold text-foreground">
                        {p.entitlements.max_menu_items ?? "Unlimited"}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          p.entitlements.floor_editor ? "text-primary" : "text-muted-foreground/40"
                        }`}
                      />
                      <span
                        className={
                          p.entitlements.floor_editor
                            ? "text-foreground font-medium"
                            : "text-muted-foreground line-through"
                        }
                      >
                        Visual Floor Plan Editor
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          p.entitlements.table_merge ? "text-primary" : "text-muted-foreground/40"
                        }`}
                      />
                      <span
                        className={
                          p.entitlements.table_merge
                            ? "text-foreground font-medium"
                            : "text-muted-foreground line-through"
                        }
                      >
                        Dynamic Table Merging
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          p.entitlements.courses ? "text-primary" : "text-muted-foreground/40"
                        }`}
                      />
                      <span
                        className={
                          p.entitlements.courses
                            ? "text-foreground font-medium"
                            : "text-muted-foreground line-through"
                        }
                      >
                        Multi-Course Pacing (KOT)
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
