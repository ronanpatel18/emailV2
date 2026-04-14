"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Contact, Template, User, Attachment } from "@/types";
import { Spinner } from "./Spinner";
import { useToast } from "./Toast";

interface SendEmailsTabProps {
  users: User[];
  selectedUserId: string;
  onChangeUserId: (id: string) => void;
}

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

const avatarColors = [
  "from-violet-400 to-violet-600",
  "from-indigo-400 to-indigo-600",
  "from-sky-400 to-sky-600",
  "from-emerald-400 to-emerald-600",
  "from-rose-400 to-rose-600",
  "from-amber-400 to-amber-600",
];

export function SendEmailsTab({ users, selectedUserId, onChangeUserId }: SendEmailsTabProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { showToast, ToastComponent } = useToast();
  const hasFetched = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [templatesRes, contactsRes, attachmentsRes] = await Promise.all([
        fetch("/api/templates"),
        fetch("/api/contacts"),
        fetch("/api/attachments"),
      ]);
      if (templatesRes.ok) setTemplates(await templatesRes.json());
      if (contactsRes.ok) setContacts(await contactsRes.json());
      if (attachmentsRes.ok) setAttachments(await attachmentsRes.json());
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchData();
  }, [fetchData]);

  const hasPersonalContacts = selectedUserId ? contacts.some((c) => c.assigned_to === selectedUserId) : false;
  const displayContacts = selectedUserId && hasPersonalContacts
    ? contacts.filter((c) => c.assigned_to === selectedUserId)
    : contacts;

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleAll = () => {
    setSelectedContacts(selectedContacts.size === displayContacts.length ? new Set() : new Set(displayContacts.map((c) => c.id)));
  };

  const toggleAttachment = (id: string) => {
    setSelectedAttachments((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleUploadPDFs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) formData.append("files", file);
      const res = await fetch("/api/attachments", { method: "POST", body: formData });
      if (res.ok) {
        const uploaded = await res.json();
        setAttachments((prev) => [...uploaded, ...prev]);
        for (const att of uploaded) setSelectedAttachments((prev) => new Set([...prev, att.id]));
        showToast(`${uploaded.length} PDF(s) uploaded`);
      } else { const err = await res.json(); showToast(err.error || "Upload failed", "error"); }
    } catch { showToast("Failed to upload PDFs", "error"); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleDeleteAttachment = async (id: string) => {
    try {
      const res = await fetch(`/api/attachments?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
        setSelectedAttachments((prev) => { const next = new Set(prev); next.delete(id); return next; });
        showToast("Attachment deleted");
      }
    } catch { showToast("Failed to delete attachment", "error"); }
  };

  const handleSend = async () => {
    if (!selectedTemplate) { showToast("Please select a template", "error"); return; }
    if (selectedContacts.size === 0) { showToast("Please select at least one contact", "error"); return; }
    const attCount = selectedAttachments.size;
    if (!confirm(`Send emails to ${selectedContacts.size} contact(s)${attCount > 0 ? ` with ${attCount} PDF attachment(s)` : ""}?`)) return;
    setSending(true);
    try {
      const res = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          contactIds: Array.from(selectedContacts),
          attachmentIds: selectedAttachments.size > 0 ? Array.from(selectedAttachments) : undefined,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`Sent: ${result.success} success, ${result.failed} failed`);
        setSelectedContacts(new Set());
      } else { const err = await res.json(); showToast(err.error || "Send failed", "error"); }
    } catch { showToast("Failed to send emails", "error"); }
    finally { setSending(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  const allSelected = displayContacts.length > 0 && selectedContacts.size === displayContacts.length;
  const canSend = !sending && selectedTemplate && selectedContacts.size > 0;

  return (
    <div>
      {ToastComponent}

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-warm-900)] tracking-tight">Send Emails</h2>
          <p className="text-sm text-[var(--color-warm-500)] mt-0.5">
            {selectedContacts.size > 0 ? `${selectedContacts.size} recipient${selectedContacts.size !== 1 ? "s" : ""} selected` : "Select a template and recipients"}
          </p>
        </div>

        {/* View selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[var(--color-warm-500)]">View:</label>
          <select
            value={selectedUserId}
            onChange={(e) => onChangeUserId(e.target.value)}
            className="input-polished bg-white w-auto text-sm py-2"
          >
            <option value="">All (Master)</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
          </select>
        </div>
      </div>

      {/* Info banner */}
      {selectedUserId && !hasPersonalContacts && (
        <div className="flex items-start gap-2.5 bg-[var(--color-accent-50)] border border-[var(--color-accent-200)] rounded-lg p-3 mb-5">
          <svg className="w-4 h-4 text-[var(--color-accent-500)] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-[var(--color-accent-700)]">No contacts assigned to this person yet — showing all contacts (Master view).</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left column: Template + Attachments ─── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Template */}
          <div className="bg-white border border-[var(--color-warm-200)] rounded-xl p-4">
            <p className="section-label mb-3">Template</p>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="input-polished bg-white"
            >
              <option value="">Choose a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type === "docx" ? "DOCX" : "Plain"}) — {t.subject}
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <div className="mt-2 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <p className="text-xs text-emerald-700 font-medium">Template selected</p>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="bg-white border border-[var(--color-warm-200)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">PDF Attachments</p>
              <span className="text-xs text-[var(--color-warm-400)]">
                {selectedAttachments.size}/{attachments.length} selected
              </span>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary-polished text-xs px-3 py-2 w-full mb-3 disabled:opacity-55"
            >
              {uploading ? (
                <><Spinner className="h-3 w-3 border-[var(--color-warm-300)] border-t-[var(--color-warm-600)]" />Uploading…</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>Upload PDFs</>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleUploadPDFs} className="hidden" />

            {attachments.length === 0 ? (
              <p className="text-xs text-[var(--color-warm-400)] text-center py-2">No attachments uploaded</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {attachments.map((att) => (
                  <label
                    key={att.id}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                      selectedAttachments.has(att.id)
                        ? "bg-[var(--color-accent-50)] border border-[var(--color-accent-200)]"
                        : "hover:bg-[var(--color-warm-50)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAttachments.has(att.id)}
                      onChange={() => toggleAttachment(att.id)}
                      className="flex-shrink-0"
                    />
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                    </svg>
                    <span className="flex-1 truncate text-[var(--color-warm-700)] font-medium">{att.file_name}</span>
                    <span className="text-[var(--color-warm-400)] flex-shrink-0">{(att.size_bytes / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteAttachment(att.id); }}
                      className="text-[var(--color-warm-300)] hover:text-red-500 transition-colors flex-shrink-0 ml-1"
                      title="Remove"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: Contacts ─────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-[var(--color-warm-200)] rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-warm-200)] bg-[var(--color-warm-50)]">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="flex-shrink-0"
                />
                <span className="text-xs font-semibold text-[var(--color-warm-600)]">
                  {allSelected ? "Deselect All" : "Select All"}
                </span>
              </label>
              <span className="text-xs text-[var(--color-warm-400)]">
                {selectedContacts.size} of {displayContacts.length} selected
              </span>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto divide-y divide-[var(--color-warm-100)]">
              {displayContacts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-warm-100)] flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-[var(--color-warm-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-[var(--color-warm-500)]">No contacts available</p>
                  <p className="text-xs text-[var(--color-warm-400)] mt-1">Add contacts in the Contacts tab</p>
                </div>
              ) : (
                displayContacts.map((contact) => {
                  const isSelected = selectedContacts.has(contact.id);
                  const initials = getInitials(contact.name);
                  const colorIdx = contact.name.charCodeAt(0) % avatarColors.length;
                  return (
                    <label
                      key={contact.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        isSelected ? "bg-[var(--color-accent-50)]" : "hover:bg-[var(--color-warm-50)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleContact(contact.id)}
                        className="flex-shrink-0"
                      />
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[colorIdx]} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 shadow-sm`}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-[var(--color-warm-900)]">{contact.name}</span>
                          {contact.company && (
                            <span className="text-xs text-[var(--color-warm-400)] truncate">({contact.company})</span>
                          )}
                        </div>
                        <span className="text-xs text-[var(--color-warm-500)]">{contact.email}</span>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[var(--color-accent-500)] flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Send Button ──────────────────────────────── */}
      <div className="mt-6 flex items-center justify-between border-t border-[var(--color-warm-200)] pt-5">
        <div className="text-xs text-[var(--color-warm-400)]">
          {selectedAttachments.size > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {selectedAttachments.size} PDF attachment{selectedAttachments.size !== 1 ? "s" : ""} included
            </span>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend}
          className="btn-primary-polished px-6 py-2.5 disabled:opacity-55 disabled:cursor-not-allowed text-sm"
        >
          {sending ? (
            <><Spinner className="h-4 w-4 border-white/30 border-t-white" />Sending…</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {selectedContacts.size === 0
                ? "Select Recipients"
                : `Send to ${selectedContacts.size} Contact${selectedContacts.size !== 1 ? "s" : ""}${selectedAttachments.size > 0 ? ` + ${selectedAttachments.size} PDF${selectedAttachments.size !== 1 ? "s" : ""}` : ""}`
              }
            </>
          )}
        </button>
      </div>
    </div>
  );
}
