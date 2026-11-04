import React from "react";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { EmptyState } from "../../components/app/EmptyState";

export const FloorPlanPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Floor Plan Editor"
        description="Visual 2D interactive canvas for drag-and-drop table layouts, rotations, and section boundaries."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Floor Plan" }]}
      />
      <EmptyState
        icon={LayoutGrid}
        title="Visual Floor Editor"
        description="Design your dining floor layout with interactive table positioning, shapes, and grid snapping."
        actionLabel="Open Layout Canvas"
        onAction={() => alert("Floor editor canvas (Prompt 3B)")}
      />
    </div>
  );
};
