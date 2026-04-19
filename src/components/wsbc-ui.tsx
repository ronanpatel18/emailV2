"use client";

import React, { useEffect, useMemo } from "react";

export const cx = (...a: (string | false | null | undefined)[]) =>
  a.filter(Boolean).join(" ");

export function initials(name?: string | null) {
  return (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((p) => (p[0] || "").toUpperCase())
    .join("");
}

export function fmtAgo(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 36e5;
  if (diffH < 24) return `${Math.max(1, Math.round(diffH))}h ago`;
  if (diffH < 24 * 7) return `${Math.round(diffH / 24)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const fmtKB = (b: number) =>
  b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;

/** Reveal-on-scroll for `.reveal` elements. Re-scans on every render so
 *  newly mounted sections (tab switches, async data) always get observed. */
export function useReveal(_dep?: unknown) {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -60px 0px" }
    );
    document.querySelectorAll(".reveal:not(.in)").forEach((n) => io.observe(n));
    return () => io.disconnect();
  });
}

export function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

export function SectionHead({
  no, eyebrow, title, desc, right,
}: {
  no: string;
  eyebrow: string;
  title: string;
  desc?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "44px 0 28px",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "end",
        gap: 24,
      }}
    >
      <div>
        <div className="eyebrow reveal">
          <span style={{ color: "var(--ink-4)" }}>{no}</span> —— {eyebrow}
        </div>
        <h2
          className="reveal"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(36px, 5vw, 68px)",
            lineHeight: 1,
            letterSpacing: "-0.025em",
            margin: "14px 0 10px",
            fontWeight: 400,
          }}
        >
          {title}
        </h2>
        {desc && (
          <p
            className="reveal"
            style={{ fontSize: 14, color: "var(--ink-3)", maxWidth: 560, margin: 0, lineHeight: 1.55 }}
          >
            {desc}
          </p>
        )}
      </div>
      {right && <div className="reveal">{right}</div>}
    </div>
  );
}

export function TemplateLine({ text }: { text: string }) {
  const parts = (text || "").split(/(\{\{[a-z_]+\}\})/gi);
  return (
    <>
      {parts.map((p, i) =>
        /^\{\{.+\}\}$/.test(p) ? (
          <span key={i} className="var">{p}</span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        )
      )}
    </>
  );
}

export function MetricTile({
  label, value, trend, sparkSeed = 1, accent,
}: {
  label: string;
  value: number | string;
  trend?: string;
  sparkSeed?: number;
  accent?: boolean;
}) {
  const points = useMemo(() => {
    let s = sparkSeed;
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const vals = Array.from({ length: 14 }, () => 0.3 + rand() * 0.7);
    const max = Math.max(...vals);
    const w = 120, h = 28;
    return vals
      .map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / max) * h + 2}`)
      .join(" ");
  }, [sparkSeed]);

  return (
    <div
      className="metric"
      style={accent ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : {}}
    >
      <div
        className="lbl"
        style={accent ? { color: "color-mix(in oklch, var(--paper) 55%, transparent)" } : {}}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", marginTop: 14, gap: 12 }}>
        <span className="val" style={accent ? { color: "var(--paper)" } : {}}>{value}</span>
        <svg className="spark" viewBox="0 0 120 32" preserveAspectRatio="none" style={{ maxWidth: 120 }}>
          <polyline
            fill="none"
            stroke={accent ? "var(--accent-3)" : "var(--line-2)"}
            strokeWidth="1.5"
            points={points}
          />
        </svg>
      </div>
      {trend && (
        <div
          className="mono"
          style={{
            marginTop: 10,
            fontSize: 10.5,
            letterSpacing: "0.08em",
            color: accent ? "color-mix(in oklch, var(--paper) 55%, transparent)" : "var(--ink-4)",
            textTransform: "uppercase",
          }}
        >
          {trend}
        </div>
      )}
    </div>
  );
}

export function Step({
  n, label, value, done, optional,
}: {
  n: string; label: string; value: string; done: boolean; optional?: boolean;
}) {
  return (
    <div
      style={{
        padding: "18px 22px",
        borderRight: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: done ? "var(--paper-2)" : "var(--paper)",
        transition: "background 180ms ease",
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "1px solid " + (done ? "var(--ink)" : "var(--line-2)"),
          background: done ? "var(--ink)" : "var(--paper)",
          color: done ? "var(--paper)" : "var(--ink-3)",
          display: "grid", placeItems: "center",
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em",
          flexShrink: 0,
        }}
      >
        {done ? "✓" : n}
      </div>
      <div style={{ lineHeight: 1.25, minWidth: 0 }}>
        <div className="eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>
          {label} {optional && <span style={{ color: "var(--ink-4)" }}>· optional</span>}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: done ? "var(--ink)" : "var(--ink-3)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
