"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Contact } from "@/types";
import { Spinner } from "./Spinner";
import { useToast } from "./Toast";
import { formatPhoneNumber } from "@/lib/template-utils";

export function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone_number: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const hasFetched = useRef(false);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch {
      // silently fail — avoid toast in data fetch to prevent re-render loops
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchContacts();

    // Fetch Google Sheet URL in background — don't trigger re-renders
    fetch("/api/sync/sheets")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.url) setSheetUrl(data.url);
      })
      .catch(() => {});
  }, [fetchContacts]);

  const resetForm = () => {
    setForm({ name: "", email: "", company: "", phone_number: "", address: "" });
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      phone_number: form.phone_number
        ? formatPhoneNumber(form.phone_number)
        : "",
    };

    try {
      const res = editing
        ? await fetch("/api/contacts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editing.id, ...payload }),
          })
        : await fetch("/api/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        showToast(editing ? "Contact updated" : "Contact added");
        resetForm();
        fetchContacts();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save", "error");
      }
    } catch {
      showToast("Failed to save contact", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;

    try {
      const res = await fetch(`/api/contacts?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Contact deleted");
        fetchContacts();
      } else {
        showToast("Failed to delete", "error");
      }
    } catch {
      showToast("Failed to delete contact", "error");
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditing(contact);
    setForm({
      name: contact.name,
      email: contact.email,
      company: contact.company || "",
      phone_number: contact.phone_number || "",
      address: contact.address || "",
    });
    setShowForm(true);
  };

  const handleSyncSheet = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/sheets", { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        const parts = [];
        if (result.inserted) parts.push(`${result.inserted} added`);
        if (result.updated) parts.push(`${result.updated} updated`);
        if (result.deleted) parts.push(`${result.deleted} removed`);
        showToast(parts.length > 0 ? `Synced: ${parts.join(", ")}` : "Already in sync");
        fetchContacts();
      } else {
        const err = await res.json();
        showToast(err.error || "Sync failed", "error");
      }
    } catch {
      showToast("Sync failed", "error");
    } finally {
      setSyncing(false);
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

      {/* Google Sheet Sync */}
      <div className="border border-[#E5E5E5] rounded-lg p-4 mb-6 bg-[#FAFAFA] shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#171717]">Shared Google Sheet</h3>
            <p className="text-xs text-[#525252] mt-0.5">
              Edit contacts directly in Google Sheets. Changes sync automatically, or press Sync Now.
            </p>
          </div>
          <div className="flex gap-2">
            {sheetUrl && (
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-black text-black rounded-md px-3 py-1.5 font-medium text-xs hover:bg-white transition-colors"
              >
                Open Google Sheet
              </a>
            )}
            <button
              onClick={handleSyncSheet}
              disabled={syncing}
              className={`bg-black text-white rounded-md px-3 py-1.5 font-medium text-xs hover:bg-[#171717] transition-colors ${syncing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Contacts</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-black text-white rounded-md px-4 py-2 font-medium text-sm hover:bg-[#171717] transition-colors"
        >
          Add Contact
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="border border-[#E5E5E5] rounded-lg p-6 mb-6 bg-white shadow-sm">
          <h3 className="text-lg font-semibold mb-4">
            {editing ? "Edit Contact" : "Add Contact"}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-gray-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-gray-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-gray-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={form.phone_number}
                onChange={(e) =>
                  setForm({ ...form, phone_number: e.target.value })
                }
                placeholder="(555) 123-4567"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-gray-400 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-gray-400 focus:outline-none"
              />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="text-[#525252] text-sm font-medium px-4 py-2 hover:text-[#171717]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-black text-white rounded-md px-4 py-2 font-medium text-sm hover:bg-[#171717] disabled:opacity-50"
              >
                {saving ? "Saving..." : editing ? "Update" : "Add"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contacts Table */}
      <div className="border border-[#E5E5E5] rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F5F5F5] border-b border-[#E5E5E5]">
              <th className="text-left px-4 py-3 font-medium text-[#525252]">
                Name
              </th>
              <th className="text-left px-4 py-3 font-medium text-[#525252]">
                Email
              </th>
              <th className="text-left px-4 py-3 font-medium text-[#525252]">
                Company
              </th>
              <th className="text-left px-4 py-3 font-medium text-[#525252]">
                Phone
              </th>
              <th className="text-left px-4 py-3 font-medium text-[#525252]">
                Address
              </th>
              <th className="text-left px-4 py-3 font-medium text-[#525252]">
                Last Sent
              </th>
              <th className="text-right px-4 py-3 font-medium text-[#525252]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-8 text-[#A3A3A3] text-sm"
                >
                  No contacts yet. Add your first contact above.
                </td>
              </tr>
            ) : (
              contacts.map((contact, idx) => (
                <tr
                  key={contact.id}
                  className={`border-b border-[#E5E5E5] ${
                    idx % 2 === 1 ? "bg-[#FAFAFA]" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{contact.name}</td>
                  <td className="px-4 py-3 text-[#525252]">{contact.email}</td>
                  <td className="px-4 py-3 text-[#525252]">
                    {contact.company || "—"}
                  </td>
                  <td className="px-4 py-3 text-[#525252]">
                    {contact.phone_number || "—"}
                  </td>
                  <td className="px-4 py-3 text-[#525252]">
                    {contact.address || "—"}
                  </td>
                  <td className="px-4 py-3 text-[#525252]">
                    {contact.last_sent_at
                      ? new Date(contact.last_sent_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(contact)}
                      className="text-[#64748B] hover:text-[#171717] text-sm font-medium mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="text-[#A3A3A3] hover:text-red-600 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
