"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Template } from "@/types";
import { Spinner } from "./Spinner";
import { useToast } from "./Toast";

export function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: "", subject: "", body: "", type: "plain" as "plain" | "docx" });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { showToast, ToastComponent } = useToast();
  const hasFetched = useRef(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) setTemplates(await res.json());
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = () => {
    setForm({ name: "", subject: "", body: "", type: "plain" });
    setFile(null);
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData();
    if (editing) formData.append("id", editing.id);
    formData.append("name", form.name);
    formData.append("subject", form.subject);
    formData.append("type", form.type);
    if (form.type === "plain") formData.append("body", form.body);
    if (form.type === "docx" && file) formData.append("file", file);
    try {
      const res = await fetch("/api/templates", { method: editing ? "PUT" : "POST", body: formData });
      if (res.ok) { showToast(editing ? "Template updated" : "Template created"); resetForm(); fetchTemplates(); }
      else { const err = await res.json(); showToast(err.error || "Failed to save", "error"); }
    } catch { showToast("Failed to save template", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
      if (res.ok) { showToast("Template deleted"); fetchTemplates(); }
      else showToast("Failed to delete", "error");
    } catch { showToast("Failed to delete template", "error"); }
  };

  const handleEdit = (template: Template) => {
    setEditing(template);
    setForm({ name: template.name, subject: template.subject, body: template.body || "", type: template.type });
    setShowForm(true);
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setUploading(true);
    const templateName = selectedFile.name.replace(/\.docx$/i, "");
    const formData = new FormData();
    formData.append("name", templateName);
    formData.append("subject", templateName);
    formData.append("type", "docx");
    formData.append("file", selectedFile);
    try {
      const res = await fetch("/api/templates", { method: "POST", body: formData });
      if (res.ok) { showToast(`Uploaded "${selectedFile.name}"`); fetchTemplates(); }
      else { const err = await res.json(); showToast(err.error || "Upload failed", "error"); }
    } catch { showToast("Upload failed", "error"); }
    finally { setUploading(false); }
    e.target.value = "";
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  return (
    <div>
      {ToastComponent}

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-warm-900)] tracking-tight">Templates</h2>
          <p className="text-sm text-[var(--color-warm-500)] mt-0.5">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className={`btn-secondary-polished cursor-pointer text-sm ${uploading ? "opacity-55 pointer-events-none" : ""}`}>
            {uploading ? (
              <><Spinner className="h-3.5 w-3.5 border-[var(--color-warm-300)] border-t-[var(--color-warm-600)]" />Uploading…</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>Upload DOCX</>
            )}
            <input type="file" accept=".docx" onChange={handleQuickUpload} className="hidden" disabled={uploading} />
          </label>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="btn-primary-polished"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Template
          </button>
        </div>
      </div>

      {/* ── Variable Reference ──────────────────────── */}
      <div className="flex items-center gap-3 bg-[var(--color-accent-50)] border border-[var(--color-accent-100)] rounded-lg px-4 py-3 mb-6">
        <svg className="w-4 h-4 text-[var(--color-accent-500)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
        <span className="text-xs font-medium text-[var(--color-accent-700)] mr-1">Available variables:</span>
        {["{{name}}", "{{email}}", "{{company}}"].map((v) => (
          <code key={v} className="bg-white border border-[var(--color-accent-200)] rounded-md px-2 py-0.5 text-xs text-[var(--color-accent-700)] font-mono">
            {v}
          </code>
        ))}
      </div>

      {/* ── Form ────────────────────────────────────── */}
      {showForm && (
        <div className="border border-[var(--color-warm-200)] rounded-xl bg-[var(--color-warm-50)] p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-warm-900)]">
              {editing ? "Edit Template" : "New Template"}
            </h3>
            <button type="button" onClick={resetForm} className="btn-ghost">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type Toggle */}
            <div className="flex items-center gap-1 p-1 bg-[var(--color-warm-100)] rounded-lg w-fit">
              {(["plain", "docx"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, type: t })}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    form.type === t
                      ? "bg-white text-[var(--color-warm-900)] shadow-sm border border-[var(--color-warm-200)]"
                      : "text-[var(--color-warm-500)] hover:text-[var(--color-warm-700)]"
                  }`}
                >
                  {t === "plain" ? "Plain Text" : "DOCX Upload"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-warm-600)] mb-1.5">Template Name *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-polished" placeholder="Welcome Email" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-warm-600)] mb-1.5">Subject Line *</label>
                <input type="text" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-polished" placeholder="Hi {{name}}, welcome aboard!" />
              </div>
            </div>

            {form.type === "plain" ? (
              <div>
                <label className="block text-xs font-medium text-[var(--color-warm-600)] mb-1.5">Body</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={8}
                  className="input-polished font-mono text-xs leading-relaxed"
                  placeholder={"Hi {{name}},\n\nThank you for your time..."}
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-[var(--color-warm-600)] mb-1.5">Upload .docx File</label>
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full border-1.5 border-dashed border-[var(--color-warm-300)] rounded-lg px-3 py-4 text-sm text-[var(--color-warm-600)] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[var(--color-warm-100)] file:text-[var(--color-warm-700)] hover:border-[var(--color-accent-400)] transition-colors cursor-pointer"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={resetForm} className="btn-secondary-polished">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary-polished disabled:opacity-55">
                {saving ? <><Spinner className="h-3.5 w-3.5 border-white/30 border-t-white" />Saving…</> : editing ? "Update Template" : "Create Template"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Templates List ───────────────────────────── */}
      {templates.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--color-warm-200)] rounded-xl">
          <div className="w-12 h-12 rounded-full bg-[var(--color-warm-100)] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[var(--color-warm-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--color-warm-500)]">No templates yet</p>
          <p className="text-xs text-[var(--color-warm-400)] mt-1">Create your first template to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <div key={template.id} className="group flex items-start gap-4 bg-white border border-[var(--color-warm-200)] rounded-xl px-4 py-4 hover:border-[var(--color-warm-300)] hover:shadow-sm transition-all duration-150">
              {/* Icon */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                template.type === "docx"
                  ? "bg-blue-50 text-blue-600"
                  : "bg-[var(--color-accent-50)] text-[var(--color-accent-600)]"
              }`}>
                {template.type === "docx" ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-semibold text-[var(--color-warm-900)] truncate">{template.name}</h4>
                  <span className={`badge ${template.type === "docx" ? "bg-blue-50 text-blue-700 border-blue-200" : "badge-accent"}`}>
                    {template.type === "docx" ? "DOCX" : "Plain Text"}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-warm-500)]">
                  <span className="text-[var(--color-warm-400)]">Subject:</span> {template.subject}
                </p>
                {template.type === "plain" && template.body && (
                  <p className="text-xs text-[var(--color-warm-400)] mt-1 truncate max-w-lg font-mono">{template.body}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => handleEdit(template)} className="btn-ghost">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </button>
                <button onClick={() => handleDelete(template.id)} className="btn-danger">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
