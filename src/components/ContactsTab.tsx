"use client";

import { useState, useEffect, useCallback, useRef, startTransition } from "react";
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

function getInitials(name: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function AvatarCell({ name }: { name: string }) {
  const initials = getInitials(name);
  const colors = [
    "from-violet-400 to-violet-600",
    "from-indigo-400 to-indigo-600",
    "from-sky-400 to-sky-600",
    "from-emerald-400 to-emerald-600",
    "from-rose-400 to-rose-600",
    "from-amber-400 to-amber-600",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 shadow-sm`}
      >
        {initials}
      </div>
      <span className="font-medium text-[var(--color-warm-900)]">{name}</span>
    </div>
  );
}

export function ContactsTab({ users, selectedUserId, onChangeUserId, currentUserId }: ContactsTabProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", assigned_to: "" });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { showToast, ToastComponent } = useToast();
  const hasFetched = useRef(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Merge incoming contacts without replacing state if nothing changed.
  // Wrapped in startTransition so background polls never interrupt user interactions.
  const mergeContacts = useCallback((incoming: Contact[]) => {
    startTransition(() => {
      setContacts((prev) => {
        if (prev.length !== incoming.length) return incoming;
        for (let i = 0; i < incoming.length; i++) {
          const p = prev[i], n = incoming[i];
          if (
            p.id !== n.id ||
            p.name !== n.name ||
            p.email !== n.email ||
            p.company !== n.company ||
            p.assigned_to !== n.assigned_to ||
            p.last_sent_at !== n.last_sent_at ||
            p.last_sent_by_name !== n.last_sent_by_name ||
            p.assigned_to_name !== n.assigned_to_name
          ) {
            return incoming; // something changed — swap
          }
        }
        return prev; // identical — skip re-render
      });
    });
  }, []);

  const fetchContacts = useCallback(async (isInitial = false) => {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) {
        const data: Contact[] = await res.json();
        mergeContacts(data);
      }
    } catch { /* silently fail */ }
    finally { if (isInitial) setLoading(false); }
  }, [mergeContacts]);

  const backgroundSync = useCallback(async () => {
    try {
      await fetch("/api/sync/sheets", { method: "POST" });
      await fetchContacts(false);
    } catch { /* silently fail */ }
  }, [fetchContacts]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchContacts(true); // initial — shows loading spinner until done
    fetch("/api/sync/sheets").then((r) => r.ok ? r.json() : null).then((d) => { if (d?.url) setSheetUrl(d.url); }).catch(() => {});
    refreshIntervalRef.current = setInterval(() => fetchContacts(false), 10000); // background — no spinner
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
        ? await fetch("/api/contacts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...form }) })
        : await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { showToast(editing ? "Contact updated" : "Contact added"); resetForm(); fetchContacts(false); }
      else { const err = await res.json(); showToast(err.error || "Failed to save", "error"); }
    } catch { showToast("Failed to save contact", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    try {
      const res = await fetch(`/api/contacts?id=${id}`, { method: "DELETE" });
      if (res.ok) { showToast("Contact deleted"); fetchContacts(false); }
      else showToast("Failed to delete", "error");
    } catch { showToast("Failed to delete contact", "error"); }
  };

  const handleEdit = (contact: Contact) => {
    setEditing(contact);
    setForm({ name: contact.name, email: contact.email, company: contact.company || "", assigned_to: contact.assigned_to || "" });
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
        fetchContacts(false);
      } else { const err = await res.json(); showToast(err.error || "Sync failed", "error"); }
    } catch { showToast("Sync failed", "error"); }
    finally { setSyncing(false); }
  };

  const hasPersonalContacts = selectedUserId ? contacts.some((c) => c.assigned_to === selectedUserId) : false;
  const displayContacts = selectedUserId && hasPersonalContacts
    ? contacts.filter((c) => c.assigned_to === selectedUserId)
    : contacts;
  const filteredContacts = searchQuery
    ? displayContacts.filter((c) => {
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q) || (c.assigned_to_name || "").toLowerCase().includes(q);
      })
    : displayContacts;
  const showingMaster = !selectedUserId || !hasPersonalContacts;

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  return (
    <div>
      {ToastComponent}

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-warm-900)] tracking-tight">
            Contacts
            <span className="ml-2 text-sm font-normal text-[var(--color-warm-400)]">
              {showingMaster ? "(Master)" : `(${users.find((u) => u.id === selectedUserId)?.name || "Personal"})`}
            </span>
          </h2>
          <p className="text-sm text-[var(--color-warm-500)] mt-0.5">
            {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary-polished"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Contact
        </button>
      </div>

      {/* ── Toolbar Row ──────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-warm-400)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="input-polished pl-9"
          />
        </div>

        {/* Sheet selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[var(--color-warm-500)] whitespace-nowrap">View:</label>
          <select
            value={selectedUserId}
            onChange={(e) => onChangeUserId(e.target.value)}
            className="input-polished bg-white w-auto text-sm py-2"
          >
            <option value="">All (Master)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
        </div>

        {/* Sheet sync */}
        <div className="flex items-center gap-2 ml-auto">
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary-polished text-xs px-3 py-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open Sheet
            </a>
          )}
          <button
            onClick={handleSyncSheet}
            disabled={syncing}
            className="btn-secondary-polished text-xs px-3 py-2 disabled:opacity-50"
          >
            {syncing ? (
              <><Spinner className="h-3 w-3 border-[var(--color-warm-400)] border-t-[var(--color-accent-600)]" /> Syncing…</>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>Sync Now</>
            )}
          </button>
        </div>
      </div>

      {/* Info banner */}
      {selectedUserId && !hasPersonalContacts && (
        <div className="flex items-start gap-2.5 bg-[var(--color-accent-50)] border border-[var(--color-accent-200)] rounded-lg p-3 mb-5">
          <svg className="w-4 h-4 text-[var(--color-accent-500)] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-[var(--color-accent-700)]">
            No contacts assigned to this person yet — showing all contacts (Master view).
            Use the <strong>Assigned To</strong> field to create their personal sheet.
          </p>
        </div>
      )}

      {/* ── Add / Edit Form ──────────────────────────── */}
      {showForm && (
        <div className="border border-[var(--color-warm-200)] rounded-xl bg-[var(--color-warm-50)] p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-warm-900)]">
              {editing ? "Edit Contact" : "New Contact"}
            </h3>
            <button type="button" onClick={resetForm} className="btn-ghost">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-warm-600)] mb-1.5">Name *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-polished" placeholder="John Smith" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-warm-600)] mb-1.5">Email *</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-polished" placeholder="john@example.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-warm-600)] mb-1.5">Company</label>
              <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input-polished" placeholder="Acme Corp" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-warm-600)] mb-1.5">Assigned To</label>
              <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="input-polished bg-white">
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
            </div>
            <div className="col-span-full flex justify-end gap-2 pt-1">
              <button type="button" onClick={resetForm} className="btn-secondary-polished">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary-polished disabled:opacity-55">
                {saving ? <><Spinner className="h-3.5 w-3.5 border-white/30 border-t-white" />Saving…</> : editing ? "Update Contact" : "Add Contact"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Contacts Table ───────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-warm-200)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-warm-50)] border-b border-[var(--color-warm-200)]">
              <th className="text-left px-4 py-3 section-label">Name</th>
              <th className="text-left px-4 py-3 section-label">Email</th>
              <th className="text-left px-4 py-3 section-label hidden md:table-cell">Company</th>
              <th className="text-left px-4 py-3 section-label hidden lg:table-cell">Assigned To</th>
              <th className="text-left px-4 py-3 section-label hidden lg:table-cell">Last Sent</th>
              <th className="text-left px-4 py-3 section-label hidden xl:table-cell">Sent By</th>
              <th className="text-right px-4 py-3 section-label">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-warm-100)]">
            {filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-14">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-warm-100)] flex items-center justify-center">
                      <svg className="w-5 h-5 text-[var(--color-warm-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-[var(--color-warm-500)] text-sm font-medium">
                      {searchQuery ? "No contacts match your search" : "No contacts yet"}
                    </p>
                    {!searchQuery && (
                      <p className="text-[var(--color-warm-400)] text-xs">Click &ldquo;Add Contact&rdquo; to get started</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredContacts.map((contact) => (
                <tr key={contact.id} className="bg-white table-row-hover group">
                  <td className="px-4 py-3">
                    <AvatarCell name={contact.name} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-warm-600)]">{contact.email}</td>
                  <td className="px-4 py-3 text-[var(--color-warm-500)] hidden md:table-cell">
                    {contact.company ? (
                      <span className="badge badge-default">{contact.company}</span>
                    ) : (
                      <span className="text-[var(--color-warm-300)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {contact.assigned_to_name ? (
                      <span className="text-[var(--color-warm-600)] text-xs">{contact.assigned_to_name}</span>
                    ) : (
                      <span className="text-[var(--color-warm-300)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-warm-500)] text-xs hidden lg:table-cell">
                    {contact.last_sent_at ? formatChicagoDate(contact.last_sent_at) : <span className="text-[var(--color-warm-300)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-warm-500)] text-xs hidden xl:table-cell">
                    {contact.last_sent_by_name || <span className="text-[var(--color-warm-300)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(contact)} className="btn-ghost" title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(contact.id)} className="btn-danger" title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2.5 text-xs text-[var(--color-warm-400)]">
        Times shown in Chicago (CT) timezone
      </p>
    </div>
  );
}
