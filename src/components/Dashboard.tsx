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
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E5E5]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Email Manager</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#525252]">
              {session?.user?.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="text-sm text-[#A3A3A3] hover:text-[#171717] font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-[#E5E5E5]">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-6">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-[#171717] text-[#171717] font-semibold"
                    : "border-transparent text-[#A3A3A3] hover:text-[#525252]"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === "Contacts" && <ContactsTab />}
        {activeTab === "Templates" && <TemplatesTab />}
        {activeTab === "Send Emails" && <SendEmailsTab />}
      </main>
    </div>
  );
}
