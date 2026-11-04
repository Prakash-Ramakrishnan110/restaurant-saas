import React from "react";
import { Sparkles } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { EmptyState } from "../../components/app/EmptyState";

export const OnboardingPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Venue Onboarding"
        description="Set up your restaurant profile, branches, operational capabilities, and initial dining tables."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Onboarding" }]}
      />
      <EmptyState
        icon={Sparkles}
        title="Onboarding Wizard"
        description="Configure your restaurant operating parameters, brand styling, and operational venue preset."
        actionLabel="Start Onboarding Wizard"
        onAction={() => alert("Onboarding wizard (Prompt 3B)")}
      />
    </div>
  );
};
