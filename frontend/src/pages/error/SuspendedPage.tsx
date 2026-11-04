import React from "react";
import { ShieldAlert, LogOut, PhoneCall } from "lucide-react";
import { Button } from "../../components/ui/button";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { useAuth } from "../../context/AuthContext";

export const SuspendedPage: React.FC = () => {
  const { logout, activeTenant } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-card p-8 rounded-xl border border-destructive/30 shadow-lg space-y-6">
        <div className="flex justify-center">
          <BrandLogo size={40} />
        </div>

        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8 stroke-[2]" />
        </div>

        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Account Suspended</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            The workspace for{" "}
            <strong className="text-foreground">
              {activeTenant?.tenant_name || "this tenant"}
            </strong>{" "}
            is currently suspended due to subscription lapse or administrative action.
          </p>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground text-left space-y-2">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <PhoneCall className="h-3.5 w-3.5 text-[#FF6A00]" />
            Resolution Support
          </div>
          <p>
            Please contact your billing administrator or Fusion Engine support at{" "}
            <a
              href="mailto:support@fusionengine.in"
              className="text-[#C2410C] underline font-medium"
            >
              support@fusionengine.in
            </a>{" "}
            to reactivate services.
          </p>
        </div>

        <div className="pt-2">
          <Button variant="outline" className="w-full" onClick={() => logout()}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};
