"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Contact, User } from "@/types";
import { Spinner } from "./Spinner";
import { useToast } from "./Toast";
import { SectionHead, MetricTile, Labeled, initials, fmtAgo } from "./wsbc-ui";

interface ContactsTabProps {
  users: User[];
  selectedUserId: string;
  onChangeUserId: (id: string) => void;
  currentUserId: string;
}

export function ContactsTab({ users, selectedUserId, onChangeUserId }: ContactsTabProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", assigned_to: "" });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const { showToast, ToastComponent } = useToast();
  const hasFetched = useRef(false);

  const mergeContacts = useCallback((incoming: Contact[]) => {
    setContacts(incoming);
  }, []);

  const fetchContacts = useCallback(async (isInitial = false) => {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) mergeContacts(await res.json());
    } catch { /* ignore */ }
    finally { if (isInitial) setLoading(false); }
  }, [mergeContacts]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    // On every fresh mount of this tab (i.e. whenever the user clicks back
    // onto Contacts), pull latest rows from the Google Sheet into Supabase,
    // then refetch contacts. Fetch the sheet URL in parallel. No background
    // polling — it only happens on mount.
    (async () => {
      try {
        const [sheetRes] = await Promise.allSettled([
          fetch("/api/sync/sheets", { method: "POST" }),
          fetch("/api/sync/sheets")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d?.url) setSheetUrl(d.url); }),
        ]);
        // If the POST sync failed, we still just show whatever Supabase has.
        void sheetRes;
      } catch { /* ignore */ }
      await fetchContacts(true);
    })();
  }, [fetchContacts]);

  const hasPersonal = selectedUserId ? contacts.some((c) => c.assigned_to === selectedUserId) : false;
  const display = selectedUserId && hasPersonal ? contacts.filter((c) => c.assigned_to === selectedUserId) : contacts;
  const filtered = q
    ? display.filter((c) =>
        [c.name, c.email, c.company, c.assigned_to_name]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q.toLowerCase()))
      )
    : display;

  // Stats reflect the currently selected view (Master = all contacts,
  // or a specific assignee's contacts). Search input does not affect
  // stats — it only narrows the table below.
  const stats = useMemo(() => {
    const sent = display.filter((c) => c.last_sent_at).length;
    const unsent = display.length - sent;
    const thisWeek = display.filter((c) => {
      if (!c.last_sent_at) return false;
      return (Date.now() - new Date(c.last_sent_at).getTime()) / 86400000 < 7;
    }).length;
    return { total: display.length, sent, unsent, thisWeek };
  }, [display]);

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

  const handleEdit = (c: Contact) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email, company: c.company || "", assigned_to: c.assigned_to || "" });
    setShowForm(true);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/sheets", { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        const parts: string[] = [];
        if (result.inserted) parts.push(`${result.inserted} added`);
        if (result.updated) parts.push(`${result.updated} updated`);
        if (result.deleted) parts.push(`${result.deleted} removed`);
        showToast(parts.length > 0 ? `Synced: ${parts.join(", ")}` : "Already in sync");
        fetchContacts(false);
      } else { const err = await res.json(); showToast(err.error || "Sync failed", "error"); }
    } catch { showToast("Sync failed", "error"); }
    finally { setSyncing(false); }
  };

  return (
    <div>
      {ToastComponent}

      <SectionHead
        no="§ 01"
        eyebrow="Directory"
        title="Contacts"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn" onClick={handleSync} disabled={syncing}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={syncing ? "spin" : undefined}>
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {syncing ? "Syncing…" : "Sync sheet"}
            </button>
            {sheetUrl && (
              <a className="btn" href={sheetUrl} target="_blank" rel="noopener noreferrer" title="Open in Sheets">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Open Sheet
              </a>
            )}
            <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: "", email: "", company: "", assigned_to: "" }); setShowForm(true); }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" />
              </svg>
              New contact
            </button>
          </div>
        }
      />

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><Spinner /></div>
      ) : <>

      {/* metrics */}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}
      >
        <MetricTile
          label="Total contacts"
          value={stats.total}
          trend={
            selectedUserId && hasPersonal
              ? users.find((u) => u.id === selectedUserId)?.name || "Assigned"
              : "Master"
          }
          sparkSeed={1}
        />
        <MetricTile
          label="Emailed"
          value={stats.sent}
          trend={stats.total > 0 ? `${Math.round((stats.sent / stats.total) * 100)}%` : "—"}
          sparkSeed={2}
          accent
        />
        <MetricTile label="Awaiting outreach" value={stats.unsent} trend="priority" sparkSeed={3} />
        <MetricTile label="This week" value={stats.thisWeek} trend="rolling 7d" sparkSeed={4} />
      </div>

      {/* toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
          background: "var(--paper)",
          marginBottom: 14,
        }}
      >
        <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }}>
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            className="field"
            placeholder="Search name, email, company, assignee…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 36, border: "1px solid transparent", background: "var(--paper-2)" }}
          />
        </div>
        <div className="hairline-vert" style={{ height: 22 }} />
        <span className="eyebrow" style={{ fontSize: 10 }}>View</span>
        <select
          className="field"
          value={selectedUserId}
          onChange={(e) => onChangeUserId(e.target.value)}
          style={{ width: "auto", minWidth: 160 }}
        >
          <option value="">Master — all contacts</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name || u.email}</option>
          ))}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-3)" }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
            {filtered.length}/{contacts.length}
          </span>
        </div>
      </div>

      {/* table */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="rowgrid row head">
          <div style={{ padding: "0 14px" }}>Name</div>
          <div style={{ padding: "0 14px" }}>Email</div>
          <div style={{ padding: "0 14px" }}>Company</div>
          <div style={{ padding: "0 14px" }}>Assigned</div>
          <div style={{ padding: "0 14px" }}>Title</div>
          <div style={{ padding: "0 14px" }}>Last sent</div>
          <div style={{ padding: "0 14px", textAlign: "right" }}>Actions</div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: "64px 24px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--ink-3)", marginBottom: 6 }}>
              Nothing to show.
            </div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.08em" }}>
              {q ? "NO MATCH" : "EMPTY DIRECTORY"}
            </div>
          </div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="rowgrid row">
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                <div className="avatar">{initials(c.name)}</div>
                <div style={{ lineHeight: 1.25 }}>
                  <div style={{ fontWeight: 500, color: "var(--ink)", fontSize: 13.5 }}>{c.name}</div>
                </div>
              </div>
              <div style={{ padding: "12px 14px", color: "var(--ink-2)", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.email}
              </div>
              <div style={{ padding: "12px 14px" }}>
                {c.company ? <span className="chip">{c.company}</span> : <span style={{ color: "var(--ink-4)" }}>—</span>}
              </div>
              <div style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--ink-2)" }}>
                {c.assigned_to_name || <span style={{ color: "var(--ink-4)" }}>Unassigned</span>}
              </div>
              <div style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--ink-2)" }}>
                {c.assigned_to_title || <span style={{ color: "var(--ink-4)" }}>—</span>}
              </div>
              <div style={{ padding: "12px 14px", fontSize: 12.5 }}>
                {c.last_sent_at ? (
                  <div>
                    <div style={{ color: "var(--ink-2)" }}>{fmtAgo(c.last_sent_at)}</div>
                    {c.last_sent_by_name && (
                      <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.04em", marginTop: 2 }}>
                        {c.last_sent_by_name.split(" ")[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="chip accent">
                    <span className="chip-dot" />
                    Not yet
                  </span>
                )}
              </div>
              <div style={{ padding: "12px 14px", display: "flex", justifyContent: "flex-end", gap: 2 }}>
                <button className="btn btn-ghost" onClick={() => handleEdit(c)} style={{ padding: "5px 8px", fontSize: 12 }}>
                  Edit
                </button>
                <button className="btn btn-ghost" onClick={() => handleDelete(c.id)} style={{ padding: "5px 8px", fontSize: 12, color: "var(--danger)" }}>
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 10, letterSpacing: "0.06em" }}>
        TIMES SHOWN IN CENTRAL — CT (CHICAGO)
      </div>

      </>}

      {showForm && (
        <div className="scrim" onClick={resetForm}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)", padding: 28 }}>
            <div className="eyebrow">{editing ? "Edit contact" : "New contact"}</div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 40, margin: "10px 0 22px", fontWeight: 400, lineHeight: 1 }}>
              {editing ? editing.name : <em>Someone new</em>}
            </h3>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
              <Labeled label="Full name">
                <input className="field" required value={form.name}
                       onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
              </Labeled>
              <Labeled label="Email">
                <input className="field" required type="email" value={form.email}
                       onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" />
              </Labeled>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Labeled label="Company">
                  <input className="field" value={form.company}
                         onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Org name" />
                </Labeled>
                <Labeled label="Assigned to">
                  <select className="field" value={form.assigned_to}
                          onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                  </select>
                </Labeled>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <button type="button" className="btn" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save changes" : "Add contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
