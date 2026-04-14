"use client";

import { useCallback, useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setVisible(true), 10);
    const exitTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 4000);
    return () => { clearTimeout(enterTimer); clearTimeout(exitTimer); };
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex items-start gap-3 px-4 py-3.5 rounded-xl shadow-lg border max-w-xs transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      } ${
        type === "success"
          ? "bg-white border-[var(--color-warm-200)] shadow-[0_4px_16px_0_rgb(0_0_0/0.08)]"
          : "bg-white border-red-200 shadow-[0_4px_16px_0_rgb(239_68_68/0.12)]"
      }`}
    >
      {/* Icon */}
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        type === "success"
          ? "bg-emerald-100 text-emerald-600"
          : "bg-red-100 text-red-600"
      }`}>
        {type === "success" ? (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>

      {/* Message */}
      <p className={`text-sm font-medium flex-1 leading-snug ${
        type === "success" ? "text-[var(--color-warm-800)]" : "text-red-700"
      }`}>
        {message}
      </p>

      {/* Dismiss */}
      <button
        onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
        className="text-[var(--color-warm-300)] hover:text-[var(--color-warm-500)] transition-colors flex-shrink-0 mt-0.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  const ToastComponent = toast ? (
    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
  ) : null;

  return { showToast, ToastComponent };
}
