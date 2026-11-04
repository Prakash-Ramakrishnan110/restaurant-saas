import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface StepItem {
  id: string;
  title: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStepIndex,
  onStepClick,
  className,
}) => {
  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol className="flex items-center justify-between w-full">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <li
              key={step.id}
              className={cn(
                "relative flex-1 flex flex-col items-center",
                idx !== steps.length - 1 &&
                  "after:content-[''] after:w-full after:h-0.5 after:bg-border after:absolute after:top-4 after:left-1/2 after:-z-10",
                idx !== steps.length - 1 && isCompleted && "after:bg-[#FF6A00]"
              )}
            >
              <button
                type="button"
                disabled={!onStepClick || idx > currentStepIndex}
                onClick={() => onStepClick?.(idx)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:ring-offset-2 min-h-[32px] min-w-[32px]",
                  isCompleted && "border-[#FF6A00] bg-[#FF6A00] text-[#0B1F3B]",
                  isCurrent &&
                    "border-[#FF6A00] bg-background text-[#FF6A00] ring-4 ring-[#FF6A00]/20",
                  !isCompleted && !isCurrent && "border-muted text-muted-foreground bg-muted/40",
                  onStepClick && idx <= currentStepIndex && "cursor-pointer"
                )}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${idx + 1}: ${step.title}`}
              >
                {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : idx + 1}
              </button>
              <span
                className={cn(
                  "mt-2 text-xs font-medium text-center",
                  isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"
                )}
              >
                {step.title}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
