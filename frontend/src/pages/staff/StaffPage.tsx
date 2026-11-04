import React from "react";
import { Users } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { EmptyState } from "../../components/app/EmptyState";

export const StaffPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & Access Control"
        description="Invite restaurant managers, cashiers, kitchen staff, and waiters with role-based permissions."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Staff" }]}
      />
      <EmptyState
        icon={Users}
        title="Invite Team Members"
        description="Add staff members to your branch, assign operational roles, and issue secure temporary passwords."
        actionLabel="Invite New Staff"
        onAction={() => alert("Invite staff modal (Prompt 3A/3B)")}
      />
    </div>
  );
};
