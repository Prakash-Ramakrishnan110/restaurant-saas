import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export interface RateLimitCountdownProps {
  initialWaitSeconds: number;
  onFinished?: () => void;
  className?: string;
}

export const RateLimitCountdown: React.FC<RateLimitCountdownProps> = ({
  initialWaitSeconds,
  onFinished,
  className,
}) => {
  const [remaining, setRemaining] = useState(initialWaitSeconds);
  const [prevInitial, setPrevInitial] = useState(initialWaitSeconds);

  if (initialWaitSeconds !== prevInitial) {
    setPrevInitial(initialWaitSeconds);
    setRemaining(initialWaitSeconds);
  }

  useEffect(() => {
    if (remaining <= 0) {
      onFinished?.();
      return;
    }

    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onFinished?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remaining, onFinished]);

  return (
    <div
      role="alert"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs font-semibold ${className}`}
    >
      <Clock className="h-4 w-4 text-amber-600 animate-spin" />
      <span>
        Rate limit reached. Please wait <strong className="font-mono text-sm">{remaining}s</strong>{" "}
        before retrying.
      </span>
    </div>
  );
};
