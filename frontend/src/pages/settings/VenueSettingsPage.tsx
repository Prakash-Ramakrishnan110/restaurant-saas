import React from "react";
import { Sliders } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { EmptyState } from "../../components/app/EmptyState";

export const VenueSettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Venue Profile & Settings"
        description="Configure invoice prefixes, tax mode (GST/VAT), branding colors, and branch capabilities."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Venue Settings" }]}
      />
      <EmptyState
        icon={Sliders}
        title="Venue Operational Settings"
        description="Configure business legal details, timezone, logo URL, receipt prefix, and branch workflow rules."
        actionLabel="Edit Business Profile"
        onAction={() => alert("Business profile form (Prompt 3B)")}
      />
    </div>
  );
};
