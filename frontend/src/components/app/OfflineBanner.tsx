import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="bg-amber-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md animate-in slide-in-from-top"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        You are currently offline. Changes will not be saved until your connection is restored.
      </span>
    </div>
  );
};
