import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-bottom-5 bg-background text-foreground",
              t.type === "success" &&
                "border-green-600/30 bg-green-50/90 dark:bg-green-950/40 text-green-900 dark:text-green-100",
              t.type === "error" &&
                "border-destructive/30 bg-red-50/90 dark:bg-red-950/40 text-red-900 dark:text-red-100",
              t.type === "info" &&
                "border-blue-600/30 bg-blue-50/90 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100"
            )}
          >
            {t.type === "success" && (
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            )}
            {t.type === "error" && (
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            )}
            {t.type === "info" && <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <h5 className="font-semibold text-sm">{t.title}</h5>
              {t.description && <p className="text-xs mt-1 opacity-90">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-sm min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Dismiss toast"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
