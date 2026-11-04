import React from "react";
import { QrCode } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { EmptyState } from "../../components/app/EmptyState";

export const QRCodesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Codes & Digital Menus"
        description="Generate, rotate, download, and batch-print QR table standees with cryptographic tokens."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "QR Codes" }]}
      />
      <EmptyState
        icon={QrCode}
        title="No QR Codes Generated"
        description="Generate contactless QR ordering codes for your dining tables and takeaway pickup counters."
        actionLabel="Batch Generate QR Codes"
        onAction={() => alert("Batch QR generator (Prompt 3C)")}
      />
    </div>
  );
};
