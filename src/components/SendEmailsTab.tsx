"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Contact, Template } from "@/types";
import { Spinner } from "./Spinner";
import { useToast } from "./Toast";

export function SendEmailsTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { showToast, ToastComponent } = useToast();
  const hasFetched = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [templatesRes, contactsRes] = await Promise.all([
        fetch("/api/templates"),
        fetch("/api/contacts"),
      ]);

      if (templatesRes.ok) setTemplates(await templatesRes.json());
      if (contactsRes.ok) setContacts(await contactsRes.json());
    } catch {
      // silently fail on initial load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchData();
  }, [fetchData]);

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate) {
      showToast("Please select a template", "error");
      return;
    }
    if (selectedContacts.size === 0) {
      showToast("Please select at least one contact", "error");
      return;
    }

    const confirmed = confirm(
      `Send emails to ${selectedContacts.size} contact(s)?`
    );
    if (!confirmed) return;

    setSending(true);
    try {
      const res = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          contactIds: Array.from(selectedContacts),
        }),
      });

      if (res.ok) {
        const result = await res.json();
        showToast(
          `Sent: ${result.success} success, ${result.failed} failed`
        );
        setSelectedContacts(new Set());
      } else {
        const err = await res.json();
        showToast(err.error || "Send failed", "error");
      }
    } catch {
      showToast("Failed to send emails", "error");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      {ToastComponent}

      <h2 className="text-2xl font-semibold mb-6">Send Emails</h2>

      {/* Template Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Template
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-gray-400 focus:outline-none bg-white"
        >
          <option value="">Choose a template...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.type === "docx" ? "DOCX" : "Plain"}) — {t.subject}
            </option>
          ))}
        </select>
      </div>

      {/* Contacts Selection */}
      <div className="border border-[#E5E5E5] rounded-lg overflow-hidden shadow-sm mb-6">
        <div className="bg-[#F5F5F5] px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-[#525252] cursor-pointer">
            <input
              type="checkbox"
              checked={
                contacts.length > 0 &&
                selectedContacts.size === contacts.length
              }
              onChange={toggleAll}
              className="accent-[#171717] w-4 h-4"
            />
            Select All ({selectedContacts.size} of {contacts.length})
          </label>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="text-center py-8 text-[#A3A3A3] text-sm">
              No contacts available. Add contacts in the Contacts tab.
            </div>
          ) : (
            contacts.map((contact, idx) => (
              <label
                key={contact.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-[#E5E5E5] cursor-pointer hover:bg-[#FAFAFA] ${
                  idx % 2 === 1 ? "bg-[#FAFAFA]" : "bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedContacts.has(contact.id)}
                  onChange={() => toggleContact(contact.id)}
                  className="accent-[#171717] w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{contact.name}</span>
                  <span className="text-sm text-[#525252] ml-2">
                    {contact.email}
                  </span>
                  {contact.company && (
                    <span className="text-xs text-[#A3A3A3] ml-2">
                      ({contact.company})
                    </span>
                  )}
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={sending || !selectedTemplate || selectedContacts.size === 0}
        className="bg-black text-white rounded-md px-6 py-2.5 font-medium text-sm hover:bg-[#171717] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {sending ? (
          <span className="flex items-center gap-2">
            <Spinner className="h-4 w-4 border-white border-t-transparent" />
            Sending...
          </span>
        ) : (
          `Send to ${selectedContacts.size} Contact${
            selectedContacts.size !== 1 ? "s" : ""
          }`
        )}
      </button>
    </div>
  );
}
