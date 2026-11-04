import React from "react";
import { Utensils } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { EmptyState } from "../../components/app/EmptyState";

export const TablesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dining Tables"
        description="View table capacities, manage table numbers, and generate tables in bulk."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Dining Tables" }]}
      />
      <EmptyState
        icon={Utensils}
        title="No Dining Tables Found"
        description="Add tables individually or use the bulk table generator to auto-generate tables across sections."
        actionLabel="Bulk Create Tables"
        onAction={() => alert("Bulk create tables (Prompt 3B)")}
      />
    </div>
  );
};
