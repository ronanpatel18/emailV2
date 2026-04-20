"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { ContactsTab } from "./ContactsTab";
import { TemplatesTab } from "./TemplatesTab";
import { SendEmailsTab } from "./SendEmailsTab";
import { initials, useReveal } from "./wsbc-ui";
import type { User } from "@/types";

type TabId = "contacts" | "templates" | "send";
const TABS: { id: TabId; label: string; idx: string }[] = [
  { id: "contacts", label: "Contacts", idx: "01" },
  { id: "templates", label: "Templates", idx: "02" },
  { id: "send", label: "Send Emails", idx: "03" },
];

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
    localStorage.setItem("wsbc_tab", tab);
  }, [tab]);

  const userName = session?.user?.name || session?.user?.email || "";
  const userEmail = session?.user?.email || "";

  return (
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
                style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--ink-4)", marginTop: 3 }}
              >
                WISCONSIN SPORTS BUSINESS CONFERENCE
              </div>
            </div>
          </div>

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
          </div>
        </div>
      </div>

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
          style={{
            marginTop: 80,
            paddingTop: 28,
            borderTop: "1px solid var(--line)",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            className="mono"
            style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "var(--ink-4)" }}
          >
            WSBC · INTERNAL · v2.6
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
            }}
          >
            {new Date()
              .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
              .toUpperCase()}{" "}
            · MADISON, WI
          </div>
        </footer>
      </main>
    </div>
  );
}
