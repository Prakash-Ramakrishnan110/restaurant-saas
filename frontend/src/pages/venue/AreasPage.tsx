import React from "react";
import { Layers } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { EmptyState } from "../../components/app/EmptyState";

export const AreasPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Areas & Sections"
        description="Organize your dining floor into service zones, rooftop dining, outdoor patios, or AC family halls."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Service Areas" }]}
      />
      <EmptyState
        icon={Layers}
        title="No Service Areas Configured"
        description="Group your tables into service areas (e.g. Ground Floor, Patio, AC Hall) to optimize staff assignments."
        actionLabel="Create Service Area"
        onAction={() => alert("Create service area dialog (Prompt 3B)")}
      />
    </div>
  );
};
