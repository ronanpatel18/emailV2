"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { ContactsTab } from "./ContactsTab";
import { TemplatesTab } from "./TemplatesTab";
import { SendEmailsTab } from "./SendEmailsTab";
import type { User } from "@/types";

const TABS = [
  { id: "Contacts", idx: "01" },
  { id: "Templates", idx: "02" },
  { id: "Send Emails", idx: "03" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function getInitials(email: string) {
  if (!email) return "?";
  const parts = email.split("@")[0].split(/[._-]/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("Contacts");
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const hasFetched = useRef(false);
  const hasSetDefault = useRef(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (hasSetDefault.current) return;
    if (users.length > 0 && session?.userId) {
      hasSetDefault.current = true;
      const currentUser = users.find((u) => u.id === session.userId);
      if (currentUser) setSelectedUserId(currentUser.id);
    }
  }, [users, session?.userId]);

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
  }, [activeTab]);

  const userEmail = session?.user?.email ?? "";
  const userName = session?.user?.name ?? userEmail;
  const initials = getInitials(userEmail);

  const today = new Date()
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      {/* ── Header ───────────────────────────────────── */}
      <header
        className="sticky top-0 z-20"
        style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)" }}
      >
        <div
          className="mx-auto flex items-center justify-between"
          style={{ maxWidth: 1320, padding: "0 40px", height: 60 }}
        >
          <div className="flex items-center" style={{ gap: 14 }}>
            <div
              className="grid place-items-center"
              style={{
                width: 28,
                height: 28,
                background: "var(--ink)",
                color: "var(--paper)",
                borderRadius: 6,
                fontFamily: "var(--font-display)",
                fontSize: 17,
                fontStyle: "italic",
              }}
            >
              W
            </div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.01em" }}>
                WSBC <span style={{ color: "var(--ink-3)" }}>·</span> Email Manager
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  color: "var(--ink-4)",
                  marginTop: 3,
                  textTransform: "uppercase",
                }}
              >
                Wisconsin Sports Business Conference
              </div>
            </div>
          </div>

          <div className="flex items-center" style={{ gap: 12 }}>
            {userEmail && (
              <>
                <div className="avatar">{initials}</div>
                <div style={{ lineHeight: 1.2 }} className="hidden sm:block">
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>
                    {userName}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{userEmail}</div>
                </div>
              </>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="btn btn-ghost"
              title="Sign out"
              aria-label="Sign out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Tabs ─────────────────────────────────────── */}
      <div
        className="sticky z-[19]"
        style={{ top: 60, background: "var(--paper)", borderBottom: "1px solid var(--line)" }}
      >
        <div
          className="mx-auto flex items-end justify-between"
          style={{ maxWidth: 1320, padding: "0 40px" }}
        >
          <nav className="flex">
            {TABS.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`tab ${isActive ? "active" : ""}`}
                >
                  <span className="idx">{t.idx}</span>
                  {t.id}
                </button>
              );
            })}
          </nav>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              letterSpacing: "0.1em",
              color: "var(--ink-4)",
              paddingBottom: 14,
              textTransform: "uppercase",
            }}
          >
            Spring · 2026
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────── */}
      <main className="mx-auto" style={{ maxWidth: 1320, padding: "32px 40px 80px" }}>
        <div className="reveal in">
          {activeTab === "Contacts" && (
            <ContactsTab
              users={users}
              selectedUserId={selectedUserId}
              onChangeUserId={setSelectedUserId}
              currentUserId={session?.userId || ""}
            />
          )}
          {activeTab === "Templates" && <TemplatesTab />}
          {activeTab === "Send Emails" && (
            <SendEmailsTab
              users={users}
              selectedUserId={selectedUserId}
              onChangeUserId={setSelectedUserId}
            />
          )}
        </div>

        <footer
          className="grid items-center"
          style={{
            marginTop: 80,
            paddingTop: 28,
            borderTop: "1px solid var(--line)",
            gridTemplateColumns: "1fr auto 1fr",
            gap: 20,
          }}
        >
          <div
            className="mono"
            style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "var(--ink-4)", textTransform: "uppercase" }}
          >
            WSBC · Internal · v2.6
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              color: "var(--ink-3)",
              fontStyle: "italic",
            }}
          >
            On, Wisconsin.
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              letterSpacing: "0.12em",
              color: "var(--ink-4)",
              textAlign: "right",
              textTransform: "uppercase",
            }}
          >
            {today} · Madison, WI
          </div>
        </footer>
      </main>
    </div>
  );
}
