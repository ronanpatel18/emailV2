"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { ContactsTab } from "./ContactsTab";
import { TemplatesTab } from "./TemplatesTab";
import { SendEmailsTab } from "./SendEmailsTab";
import { initials, useReveal } from "./wsbc-ui";
import type { User } from "@/types";

<<<<<<< HEAD
type TabId = "contacts" | "templates" | "send";
const TABS: { id: TabId; label: string; idx: string }[] = [
  { id: "contacts", label: "Contacts", idx: "01" },
  { id: "templates", label: "Templates", idx: "02" },
  { id: "send", label: "Send Emails", idx: "03" },
];
=======
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
>>>>>>> e59257b5609b78382d2baba47e5bd81ed475a3fd

export function Dashboard() {
  const [tab, setTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "contacts";
    return (localStorage.getItem("wsbc_tab") as TabId) || "contacts";
  });
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const hasFetched = useRef(false);
  const hasSetDefault = useRef(false);

  useReveal(tab);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) setUsers(await res.json());
    } catch { /* ignore */ }
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
      const u = users.find((x) => x.id === session.userId);
      if (u) setSelectedUserId(u.id);
    }
  }, [users, session?.userId]);

  useEffect(() => {
<<<<<<< HEAD
    localStorage.setItem("wsbc_tab", tab);
  }, [tab]);

  const userName = session?.user?.name || session?.user?.email || "";
  const userEmail = session?.user?.email || "";
=======
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
>>>>>>> e59257b5609b78382d2baba47e5bd81ed475a3fd

  const today = new Date()
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();

  return (
<<<<<<< HEAD
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      {/* TOP NAV */}
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          background: "var(--paper)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            padding: "0 40px",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 28, height: 28,
                background: "var(--ink)", color: "var(--paper)",
                borderRadius: 6,
                display: "grid", placeItems: "center",
                fontFamily: "var(--font-display)",
                fontSize: 17, fontStyle: "italic",
=======
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
>>>>>>> e59257b5609b78382d2baba47e5bd81ed475a3fd
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
<<<<<<< HEAD
                style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--ink-4)", marginTop: 3 }}
              >
                WISCONSIN SPORTS BUSINESS CONFERENCE
=======
                style={{
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  color: "var(--ink-4)",
                  marginTop: 3,
                  textTransform: "uppercase",
                }}
              >
                Wisconsin Sports Business Conference
>>>>>>> e59257b5609b78382d2baba47e5bd81ed475a3fd
              </div>
            </div>
          </div>

<<<<<<< HEAD
          {userEmail && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="avatar">{initials(userName)}</div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{userName}</div>
                <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{userEmail}</div>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => signOut({ callbackUrl: "/signin" })}
                title="Sign out"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* TAB BAR */}
      <div
        style={{
          borderBottom: "1px solid var(--line)",
          background: "var(--paper)",
          position: "sticky",
          top: 60,
          zIndex: 19,
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            padding: "0 40px",
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
          }}
        >
          <nav>
            {TABS.map((t) => (
              <button
                key={t.id}
                className={"tab" + (tab === t.id ? " active" : "")}
                onClick={() => setTab(t.id)}
              >
                <span className="idx">{t.idx}</span>
                {t.label}
              </button>
            ))}
          </nav>
          <div
            className="mono"
            style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--ink-4)", paddingBottom: 14 }}
          >
            SPRING · 2026
=======
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
>>>>>>> e59257b5609b78382d2baba47e5bd81ed475a3fd
          </div>
        </div>
      </div>

<<<<<<< HEAD
      <main style={{ maxWidth: 1320, margin: "0 auto", padding: "0 40px 80px" }}>
        {tab === "contacts" && (
          <ContactsTab
            users={users}
            selectedUserId={selectedUserId}
            onChangeUserId={setSelectedUserId}
            currentUserId={session?.userId || ""}
          />
        )}
        {tab === "templates" && <TemplatesTab />}
        {tab === "send" && (
          <SendEmailsTab
            users={users}
            selectedUserId={selectedUserId}
            onChangeUserId={setSelectedUserId}
          />
        )}

        <footer
=======
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
>>>>>>> e59257b5609b78382d2baba47e5bd81ed475a3fd
          style={{
            marginTop: 80,
            paddingTop: 28,
            borderTop: "1px solid var(--line)",
<<<<<<< HEAD
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
=======
            gridTemplateColumns: "1fr auto 1fr",
>>>>>>> e59257b5609b78382d2baba47e5bd81ed475a3fd
            gap: 20,
          }}
        >
          <div
            className="mono"
<<<<<<< HEAD
            style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "var(--ink-4)" }}
          >
            WSBC · INTERNAL · v2.6
=======
            style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "var(--ink-4)", textTransform: "uppercase" }}
          >
            WSBC · Internal · v2.6
>>>>>>> e59257b5609b78382d2baba47e5bd81ed475a3fd
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
<<<<<<< HEAD
            }}
          >
            {new Date()
              .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
              .toUpperCase()}{" "}
            · MADISON, WI
=======
              textTransform: "uppercase",
            }}
          >
            {today} · Madison, WI
>>>>>>> e59257b5609b78382d2baba47e5bd81ed475a3fd
          </div>
        </footer>
      </main>
    </div>
  );
}
