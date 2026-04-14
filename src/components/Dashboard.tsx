"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { ContactsTab } from "./ContactsTab";
import { TemplatesTab } from "./TemplatesTab";
import { SendEmailsTab } from "./SendEmailsTab";
import type { User } from "@/types";

const TABS = ["Contacts", "Templates", "Send Emails"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  Contacts: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Templates: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  "Send Emails": (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
};

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

  const userEmail = session?.user?.email ?? "";
  const initials = getInitials(userEmail);

  return (
    <div className="min-h-screen bg-[var(--color-warm-50)]">
      {/* ── Header ───────────────────────────────────── */}
      <header className="bg-white border-b border-[var(--color-warm-200)] sticky top-0 z-20 shadow-[0_1px_0_0_var(--color-warm-200)]">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)" }}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-base font-semibold text-[var(--color-warm-900)] tracking-tight">
              Email Manager
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {userEmail && (
              <div className="hidden sm:flex items-center gap-2.5 pr-3 border-r border-[var(--color-warm-200)]">
                <div className="avatar-initials">{initials}</div>
                <span className="text-sm text-[var(--color-warm-600)] font-medium max-w-[180px] truncate">
                  {userEmail}
                </span>
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="btn-ghost text-[var(--color-warm-500)] flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ───────────────────────────── */}
      <div className="bg-white border-b border-[var(--color-warm-200)]">
        <div className="max-w-6xl mx-auto px-5">
          <nav className="flex gap-1 overflow-x-auto no-scrollbar py-2">
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-500)] ${
                    isActive
                      ? "bg-[var(--color-accent-50)] text-[var(--color-accent-700)] shadow-[inset_0_0_0_1px_var(--color-accent-200)]"
                      : "text-[var(--color-warm-500)] hover:bg-[var(--color-warm-100)] hover:text-[var(--color-warm-800)]"
                  }`}
                >
                  <span className={isActive ? "text-[var(--color-accent-600)]" : "text-[var(--color-warm-400)]"}>
                    {TAB_ICONS[tab]}
                  </span>
                  {tab}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Tab Content ──────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-5 py-8">
        <div className="bg-white rounded-xl border border-[var(--color-warm-200)] shadow-[0_1px_4px_0_rgb(0_0_0/0.05)] p-6 sm:p-8 overflow-hidden">
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
      </main>
    </div>
  );
}
