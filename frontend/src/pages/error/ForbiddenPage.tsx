import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldBan, ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-card p-8 rounded-xl border shadow space-y-6">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldBan className="h-8 w-8 stroke-[2]" />
        </div>

        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">
            403 - Permission Denied
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Your current staff role does not have authorization to view or manage this resource.
          </p>
        </div>

        <div>
          <Button variant="default" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};
