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

export function SendEmailsTab({ users, selectedUserId, onChangeUserId }: SendEmailsTabProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set()
  );
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(
    new Set()
  );
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

  // Filter contacts by selected person
  const hasPersonalContacts = selectedUserId
    ? contacts.some((c) => c.assigned_to === selectedUserId)
    : false;

  const displayContacts =
    selectedUserId && hasPersonalContacts
      ? contacts.filter((c) => c.assigned_to === selectedUserId)
      : contacts;

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedContacts.size === displayContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(displayContacts.map((c) => c.id)));
    }
  };

  const toggleAttachment = (id: string) => {
    setSelectedAttachments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUploadPDFs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }

      const res = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const uploaded = await res.json();
        setAttachments((prev) => [...uploaded, ...prev]);
        // Auto-select newly uploaded files
        for (const att of uploaded) {
          setSelectedAttachments((prev) => new Set([...prev, att.id]));
        }
        showToast(`${uploaded.length} PDF(s) uploaded`);
      } else {
        const err = await res.json();
        showToast(err.error || "Upload failed", "error");
      }
    } catch {
      showToast("Failed to upload PDFs", "error");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    try {
      const res = await fetch(`/api/attachments?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
        setSelectedAttachments((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        showToast("Attachment deleted");
      }
    } catch {
      showToast("Failed to delete attachment", "error");
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

    const attCount = selectedAttachments.size;
    const confirmed = confirm(
      `Send emails to ${selectedContacts.size} contact(s)${
        attCount > 0 ? ` with ${attCount} PDF attachment(s)` : ""
      }?`
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
          attachmentIds:
            selectedAttachments.size > 0
              ? Array.from(selectedAttachments)
              : undefined,
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
        </div>
      )}

      {/* Template Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--color-warm-700)] mb-1">
          Select Template
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="input-polished max-w-md bg-white"
        >
          <option value="">Choose a template...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.type === "docx" ? "DOCX" : "Plain"}) — {t.subject}
            </option>
          ))}
        </select>
      </div>

      {/* PDF Attachments */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--color-warm-700)] mb-2">
          PDF Attachments (optional)
        </label>
        <div className="card-polished p-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary-polished text-xs px-3 py-1.5"
            >
              {uploading ? "Uploading..." : "Upload PDFs"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleUploadPDFs}
              className="hidden"
            />
            <span className="text-xs text-[var(--color-warm-500)]">
              {selectedAttachments.size} of {attachments.length} selected
            </span>
          </div>

          {attachments.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {attachments.map((att) => (
                <label
                  key={att.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--color-warm-50)] cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedAttachments.has(att.id)}
                    onChange={() => toggleAttachment(att.id)}
                    className="accent-[#171717] w-4 h-4"
                  />
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                  </svg>
                  <span className="flex-1 truncate">{att.file_name}</span>
                  <span className="text-xs text-[var(--color-warm-400)]">
                    {(att.size_bytes / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteAttachment(att.id);
                    }}
                    className="text-[var(--color-warm-400)] hover:text-red-600 text-xs ml-1"
                  >
                    Remove
                  </button>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contacts Selection */}
      <div className="card-polished overflow-hidden mb-6">
        <div className="bg-[var(--color-warm-50)] px-4 py-3 border-b border-[var(--color-warm-200)] flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-warm-600)] cursor-pointer">
            <input
              type="checkbox"
              checked={
                displayContacts.length > 0 &&
                selectedContacts.size === displayContacts.length
              }
              onChange={toggleAll}
              className="accent-[#171717] w-4 h-4"
            />
            Select All ({selectedContacts.size} of {displayContacts.length})
          </label>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {displayContacts.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-warm-400)] text-sm">
              No contacts available. Add contacts in the Contacts tab.
            </div>
          ) : (
            displayContacts.map((contact, idx) => (
              <label
                key={contact.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--color-warm-200)] cursor-pointer hover:bg-[var(--color-warm-50)] ${
                  idx % 2 === 1 ? "bg-[var(--color-warm-50)]" : "bg-white"
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
                  <span className="text-sm text-[var(--color-warm-600)] ml-2">
                    {contact.email}
                  </span>
                  {contact.company && (
                    <span className="text-xs text-[var(--color-warm-400)] ml-2">
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
        className="btn-primary-polished px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? (
          <span className="flex items-center gap-2">
            <Spinner className="h-4 w-4 border-white border-t-transparent" />
            Sending...
          </span>
        ) : (
          `Send to ${selectedContacts.size} Contact${
            selectedContacts.size !== 1 ? "s" : ""
          }${
            selectedAttachments.size > 0
              ? ` + ${selectedAttachments.size} PDF${
                  selectedAttachments.size !== 1 ? "s" : ""
                }`
              : ""
          }`
        )}
      </button>
    </div>
  );
}
