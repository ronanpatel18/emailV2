"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { ContactsTab } from "./ContactsTab";
import { TemplatesTab } from "./TemplatesTab";
import { SendEmailsTab } from "./SendEmailsTab";

const TABS = ["Contacts", "Templates", "Send Emails"] as const;
type Tab = (typeof TABS)[number];

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("Contacts");
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-[var(--color-warm-50)] transition-all-smooth">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-warm-200)] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--color-warm-900)] rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-[var(--color-warm-900)] tracking-tight">Email Manager</h1>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-[var(--color-warm-600)] hidden sm:inline-block">
                {session?.user?.email}
              </span>
            </div>
            <div className="h-4 w-px bg-[var(--color-warm-200)] hidden sm:block"></div>
            <button
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="text-sm text-[var(--color-warm-500)] hover:text-[var(--color-warm-900)] font-medium transition-colors focus-ring-polished rounded-md px-2 py-1"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-[var(--color-warm-200)] shadow-sm">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-8 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 text-sm font-medium border-b-2 transition-all-smooth whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-warm-800)] focus-visible:ring-offset-2 -mb-[1px] ${
                  activeTab === tab
                    ? "border-[var(--color-warm-900)] text-[var(--color-warm-900)]"
                    : "border-transparent text-[var(--color-warm-500)] hover:text-[var(--color-warm-800)] hover:border-[var(--color-warm-300)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-6xl mx-auto px-6 py-10 animate-in fade-in duration-500">
        <div className="bg-white card-polished p-6 sm:p-8 overflow-hidden">
          {activeTab === "Contacts" && <ContactsTab />}
          {activeTab === "Templates" && <TemplatesTab />}
          {activeTab === "Send Emails" && <SendEmailsTab />}
        </div>
      </main>
    </div>
  );
}
