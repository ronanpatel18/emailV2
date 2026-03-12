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
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-warm-50)]">
      {/* Background decoration elements for premium feel */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--color-warm-200)]/30 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--color-warm-200)]/20 blur-3xl" />
      </div>

      <div className="card-polished w-full max-w-md p-10 relative z-10 flex flex-col items-center">
        {/* Subtle icon/logo placeholder */}
        <div className="w-12 h-12 bg-[var(--color-warm-900)] rounded-xl flex items-center justify-center mb-8 shadow-sm">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-[var(--color-warm-900)] tracking-tight mb-2">
          Welcome back
        </h1>
        <p className="text-sm text-[var(--color-warm-500)] text-center mb-8">
          Sign in with your @wisc.edu Microsoft account to continue to Email Manager.
        </p>

        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="btn-primary-polished w-full py-2.5 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5 opacity-90 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
            </svg>
          )}
          <span>{isLoading ? "Signing in..." : "Continue with Microsoft"}</span>
        </button>

        <div className="mt-8 pt-6 border-t border-[var(--color-warm-200)] w-full text-center">
          <p className="text-xs text-[var(--color-warm-400)]">
            Secured access. Only authorized personnel.
          </p>
        </div>
      </div>
    </div>
  );
}
