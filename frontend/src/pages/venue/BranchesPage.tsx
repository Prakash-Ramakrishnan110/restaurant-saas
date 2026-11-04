import React from "react";
import { GitBranch } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { EmptyState } from "../../components/app/EmptyState";

export const BranchesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Manage multi-location branch outlets, operational presets, and branch-specific capabilities."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Branches" }]}
      />
      <EmptyState
        icon={GitBranch}
        title="No Additional Branches"
        description="Your restaurant currently operates from the primary branch. Add new branch locations to scale your operations."
        actionLabel="Add New Branch"
        onAction={() => alert("Add branch dialog (Prompt 3B)")}
      />
    </div>
  );
};
