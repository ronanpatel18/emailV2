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
    <section
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
      }}
    >
      <div className="grid-bg" />
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: 40 }}>
        <div
          style={{
            width: 52,
            height: 52,
            background: "var(--ink)",
            color: "var(--paper)",
            borderRadius: 10,
            display: "inline-grid",
            placeItems: "center",
            fontFamily: "var(--font-display)",
            fontSize: 32,
            fontStyle: "italic",
            marginBottom: 28,
          }}
        >
          W
        </div>
        <h1 className="hero-h1" style={{ fontSize: "clamp(52px, 8vw, 96px)", marginBottom: 12 }}>
          <span className="kw-wrap">
            <span className="kw" style={{ animationDelay: "60ms" }}>WSBC</span>
          </span>
        </h1>
        <div
          className="mono"
          style={{ fontSize: 11.5, letterSpacing: "0.18em", color: "var(--ink-3)", marginBottom: 40 }}
        >
          EMAIL MANAGER
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSignIn}
          disabled={isLoading}
          style={{ padding: "12px 22px", fontSize: 14 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
          </svg>
          {isLoading ? "Signing in…" : "Continue with Microsoft"}
          <span style={{ opacity: 0.6, marginLeft: 6 }}>→</span>
        </button>
        <div
          className="mono"
          style={{
            marginTop: 40,
            fontSize: 10.5,
            letterSpacing: "0.14em",
            color: "var(--ink-4)",
          }}
        >
          SECURED · WISC.EDU ONLY
        </div>
      </div>
    </section>
  );
}
