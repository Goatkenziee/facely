"use client";

import * as React from "react";

interface ToastContextValue {
  toasts: Array<{ id: string; message: string; type: "success" | "error" | "info" }>;
  addToast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  toasts: [],
  addToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<
    Array<{ id: string; message: string; type: "success" | "error" | "info" }>
  >([]);

  const addToast = React.useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-in slide-in-from-right rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm ${
              toast.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                : toast.type === "error"
                ? "border-red-500/30 bg-red-500/15 text-red-300"
                : "border-white/10 bg-white/10 text-slate-300"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastContext);
}
