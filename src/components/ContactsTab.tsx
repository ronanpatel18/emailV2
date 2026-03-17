"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Contact, User } from "@/types";
import { Spinner } from "./Spinner";
import { useToast } from "./Toast";
import { formatChicagoDate } from "@/lib/template-utils";

interface ContactsTabProps {
  users: User[];
  selectedUserId: string;
  onChangeUserId: (id: string) => void;
  currentUserId: string;
}

export function ContactsTab({ users, selectedUserId, onChangeUserId, currentUserId }: ContactsTabProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    assigned_to: "",
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { showToast, ToastComponent } = useToast();
  const hasFetched = useRef(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Background sync: pull from sheet then refresh contacts
  const backgroundSync = useCallback(async () => {
    try {
      await fetch("/api/sync/sheets", { method: "POST" });
      await fetchContacts();
    } catch {
      // silently fail on background sync
    }
  }, [fetchContacts]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchContacts();

    // Fetch Google Sheet URL
    fetch("/api/sync/sheets")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.url) setSheetUrl(data.url);
      })
      .catch(() => {});

    // Auto-refresh contacts from DB every 10 seconds
    refreshIntervalRef.current = setInterval(fetchContacts, 10000);

    // Full sheet sync every 60 seconds
    syncIntervalRef.current = setInterval(backgroundSync, 60000);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [fetchContacts, backgroundSync]);

  const resetForm = () => {
    setForm({ name: "", email: "", company: "", assigned_to: "" });
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = editing
        ? await fetch("/api/contacts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editing.id, ...form }),
          })
        : await fetch("/api/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
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
      assigned_to: contact.assigned_to || "",
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

  // Filter contacts by selected person
  const personFilteredContacts = selectedUserId
    ? contacts.filter((c) => c.assigned_to === selectedUserId)
    : contacts;

  // Check if selected user has any contacts assigned — if not, show all (master view)
  const hasPersonalContacts = selectedUserId
    ? contacts.some((c) => c.assigned_to === selectedUserId)
    : false;

  const displayContacts =
    selectedUserId && hasPersonalContacts
      ? personFilteredContacts
      : contacts;

  // Apply search filter
  const filteredContacts = searchQuery
    ? displayContacts.filter((c) => {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.company || "").toLowerCase().includes(q) ||
          (c.assigned_to_name || "").toLowerCase().includes(q)
        );
      })
    : displayContacts;

  const showingMaster = !selectedUserId || !hasPersonalContacts;

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
      <div className="card-polished bg-[var(--color-warm-50)] p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-warm-900)]">Shared Google Sheet</h3>
            <p className="text-xs text-[var(--color-warm-600)] mt-0.5">
              Edit contacts directly in Google Sheets. Changes sync automatically every 60s, or press Sync Now.
            </p>
          </div>
          <div className="flex gap-2">
            {sheetUrl && (
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary-polished text-xs px-3 py-1.5"
              >
                Open Google Sheet
              </a>
            )}
            <button
              onClick={handleSyncSheet}
              disabled={syncing}
              className={`btn-primary-polished text-xs px-3 py-1.5 ${syncing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>
      </div>

      {/* Person / Sheet Selector */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-medium text-[var(--color-warm-700)]">View Sheet:</label>
        <select
          value={selectedUserId}
          onChange={(e) => onChangeUserId(e.target.value)}
          className="input-polished bg-white max-w-xs text-sm"
        >
          <option value="">All Contacts (Master)</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email}
            </option>
          ))}
        </select>
      </div>

      {/* Info banner when showing master view as fallback */}
      {selectedUserId && !hasPersonalContacts && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-700">
          No contacts assigned to this person yet. Showing all contacts (Master view).
          Assign contacts using the &ldquo;Assigned To&rdquo; field to create their personal sheet.
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">
          Contacts
          {showingMaster ? (
            <span className="text-sm font-normal text-[var(--color-warm-500)] ml-2">(Master)</span>
          ) : (
            <span className="text-sm font-normal text-[var(--color-warm-500)] ml-2">
              ({users.find((u) => u.id === selectedUserId)?.name || "Personal"})
            </span>
          )}
        </h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary-polished"
        >
          Add Contact
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, company, or assigned to..."
          className="input-polished w-full max-w-md"
        />
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card-polished p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editing ? "Edit Contact" : "Add Contact"}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-700)] mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-polished"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-700)] mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-polished"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-700)] mb-1">
                Company
              </label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="input-polished"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-700)] mb-1">
                Assigned To
              </label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                className="input-polished bg-white"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="text-[var(--color-warm-600)] text-sm font-medium px-4 py-2 hover:text-[var(--color-warm-900)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary-polished disabled:opacity-50"
              >
                {saving ? "Saving..." : editing ? "Update" : "Add"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contacts Table */}
      <div className="card-polished overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-warm-100)] border-b border-[var(--color-warm-200)] text-[var(--color-warm-900)] text-sm">
              <th className="text-left px-4 py-3 font-medium text-[var(--color-warm-600)]">
                Name
              </th>
              <th className="text-left px-4 py-3 font-medium text-[var(--color-warm-600)]">
                Email
              </th>
              <th className="text-left px-4 py-3 font-medium text-[var(--color-warm-600)]">
                Company
              </th>
              <th className="text-left px-4 py-3 font-medium text-[var(--color-warm-600)]">
                Assigned To
              </th>
              <th className="text-left px-4 py-3 font-medium text-[var(--color-warm-600)]">
                Last Sent
              </th>
              <th className="text-left px-4 py-3 font-medium text-[var(--color-warm-600)]">
                Sent By
              </th>
              <th className="text-right px-4 py-3 font-medium text-[var(--color-warm-600)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-8 text-[var(--color-warm-400)] text-sm"
                >
                  {searchQuery
                    ? "No contacts match your search."
                    : "No contacts yet. Add your first contact above."}
                </td>
              </tr>
            ) : (
              filteredContacts.map((contact, idx) => (
                <tr
                  key={contact.id}
                  className={`border-b border-[var(--color-warm-200)] ${
                    idx % 2 === 1 ? "bg-[var(--color-warm-50)]" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{contact.name}</td>
                  <td className="px-4 py-3 text-[var(--color-warm-600)]">{contact.email}</td>
                  <td className="px-4 py-3 text-[var(--color-warm-600)]">
                    {contact.company || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-warm-600)]">
                    {contact.assigned_to_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-warm-600)]">
                    {contact.last_sent_at
                      ? formatChicagoDate(contact.last_sent_at)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-warm-600)]">
                    {contact.last_sent_by_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(contact)}
                      className="text-[var(--color-warm-500)] hover:text-[var(--color-warm-900)] text-sm font-medium mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="text-[var(--color-warm-400)] hover:text-red-600 text-sm font-medium"
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

      <div className="mt-3 text-xs text-[var(--color-warm-400)]">
        {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}
        {searchQuery && ` matching "${searchQuery}"`}
        {" · "}Times shown in Chicago (CT) timezone
      </div>
    </div>
  );
}
