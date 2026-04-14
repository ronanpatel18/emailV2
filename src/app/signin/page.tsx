"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    await signIn("microsoft-entra-id", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #eef2ff 50%, #faf5ff 100%)" }}>

      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #c7d2fe 0%, transparent 70%)" }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #a5b4fc 0%, transparent 70%)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-2xl shadow-indigo-100/50 p-8">
          {/* Logo mark */}
          <div className="flex justify-center mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)" }}
            >
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-7">
            <h1 className="text-2xl font-semibold text-[var(--color-warm-900)] tracking-tight mb-1.5">
              Welcome back
            </h1>
            <p className="text-sm text-[var(--color-warm-500)] leading-relaxed">
              Sign in with your <span className="font-medium text-[var(--color-warm-700)]">@wisc.edu</span> Microsoft account to continue.
            </p>
          </div>

          {/* Sign-in button */}
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: isLoading ? "#e0e7ff" : "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
              color: "white",
              boxShadow: isLoading ? "none" : "0 4px 14px 0 rgb(79 70 229 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.1)",
            }}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-indigo-200">Signing in…</span>
              </>
            ) : (
              <>
                {/* Microsoft logo */}
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
                </svg>
                Continue with Microsoft
              </>
            )}
          </button>

          {/* Divider */}
          <div className="mt-6 pt-5 border-t border-[var(--color-warm-100)] text-center">
            <div className="flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[var(--color-warm-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-xs text-[var(--color-warm-400)]">Secured access — authorized personnel only</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[var(--color-warm-400)] mt-5">
          Email Manager · WSBC
        </p>
      </div>
    </div>
  );
}
