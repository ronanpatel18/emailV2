"use client";

import { useCallback, useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 200);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      } ${
        type === "success"
          ? "bg-white border-[var(--color-warm-200)] text-[var(--color-warm-900)]"
          : "bg-white border-red-300 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  const ToastComponent = toast ? (
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={() => setToast(null)}
    />
  ) : null;

  return { showToast, ToastComponent };
}
