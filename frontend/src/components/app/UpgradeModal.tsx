import React from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

export interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitKey?: string;
  current?: number;
  limit?: number;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  onOpenChange,
  limitKey = "resource",
  current = 0,
  limit = 0,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF6A00]/10 text-[#FF6A00] mb-2">
            <Sparkles className="h-6 w-6 stroke-[2]" />
          </div>
          <DialogTitle>Plan Limit Reached</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Your current subscription tier allows up to{" "}
            <strong className="text-foreground">{limit}</strong>{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{limitKey}</code> (currently
            utilizing <strong className="text-foreground">{current}</strong>). Upgrade to a higher
            plan to unlock more venue scale.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="default"
            onClick={() => {
              window.open("https://fusionengine.in/pricing", "_blank");
              onOpenChange(false);
            }}
          >
            Upgrade Plan
            <ArrowUpRight className="h-4 w-4 ml-1.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
