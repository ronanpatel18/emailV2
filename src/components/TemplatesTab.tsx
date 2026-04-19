"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Template } from "@/types";
import { Spinner } from "./Spinner";
import { useToast } from "./Toast";
import { SectionHead, TemplateLine, Labeled, useReveal } from "./wsbc-ui";

export function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: "", subject: "", body: "", type: "plain" as "plain" | "docx" });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const hasFetched = useRef(false);

  useReveal(templates.length);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        setSelected((cur) => cur ?? data[0]?.id ?? null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchTemplates();
  }, [fetchTemplates]);

  const current = templates.find((t) => t.id === selected) || null;

  const resetForm = () => {
    setForm({ name: "", subject: "", body: "", type: "plain" });
    setFile(null);
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    if (editing) fd.append("id", editing.id);
    fd.append("name", form.name);
    fd.append("subject", form.subject);
    fd.append("type", form.type);
    if (form.type === "plain") fd.append("body", form.body);
    if (form.type === "docx" && file) fd.append("file", file);
    try {
      const res = await fetch("/api/templates", { method: editing ? "PUT" : "POST", body: fd });
      if (res.ok) { showToast(editing ? "Template updated" : "Template created"); resetForm(); fetchTemplates(); }
      else { const err = await res.json(); showToast(err.error || "Failed to save", "error"); }
    } catch { showToast("Failed to save template", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Template deleted");
        if (selected === id) setSelected(null);
        fetchTemplates();
      } else showToast("Failed to delete", "error");
    } catch { showToast("Failed to delete template", "error"); }
  };

  const handleEdit = (t: Template) => {
    setEditing(t);
    setForm({ name: t.name, subject: t.subject, body: t.body || "", type: t.type });
    setShowForm(true);
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const tplName = f.name.replace(/\.docx$/i, "");
    const fd = new FormData();
    fd.append("name", tplName);
    fd.append("subject", tplName);
    fd.append("type", "docx");
    fd.append("file", f);
    try {
      const res = await fetch("/api/templates", { method: "POST", body: fd });
      if (res.ok) { showToast(`Uploaded "${f.name}"`); fetchTemplates(); }
      else { const err = await res.json(); showToast(err.error || "Upload failed", "error"); }
    } catch { showToast("Upload failed", "error"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}><Spinner /></div>;
  }

  return (
    <div>
      {ToastComponent}
      <SectionHead
        no="§ 02"
        eyebrow="Library"
        title="Templates"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <label className="btn" style={{ cursor: "pointer" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {uploading ? "Uploading…" : "Upload .docx"}
              <input type="file" accept=".docx" style={{ display: "none" }} onChange={handleQuickUpload} disabled={uploading} />
            </label>
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" />
              </svg>
              New template
            </button>
          </div>
        }
      />

      {/* Variable banner */}
      <div
        className="reveal"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 18px",
          borderRadius: "var(--radius-lg)",
          background: "var(--paper-2)",
          border: "1px solid var(--line)",
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <span className="eyebrow" style={{ fontSize: 10 }}>Available variables</span>
        <div className="hairline-vert" style={{ height: 18 }} />
        {["{{name}}", "{{email}}", "{{company}}", "{{sender}}", "{{title}}"].map((v) => (
          <code key={v} className="mono" style={{
            fontSize: 12, padding: "3px 9px",
            background: "var(--paper)", border: "1px solid var(--line)",
            borderRadius: 5, color: "var(--accent)",
          }}>
            {v}
          </code>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-4)" }}>
          Rendered per-contact before send
        </div>
      </div>

      {/* Split: list + preview */}
      <div className="reveal" style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20 }}>
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div className="row head" style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px",
          }}>
            <span>{templates.length} templates</span>
            <span style={{ fontSize: 10 }}>sorted · recent</span>
          </div>
          {templates.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-3)", marginBottom: 6 }}>
                No templates yet.
              </div>
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.08em" }}>CREATE YOUR FIRST</div>
            </div>
          ) : templates.map((t, i) => {
            const on = selected === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "16px 18px", border: 0,
                  borderTop: "1px solid var(--line)",
                  background: on ? "var(--paper-2)" : "var(--paper)",
                  cursor: "pointer", position: "relative",
                  transition: "background 120ms ease",
                }}
              >
                {on && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "var(--ink)" }} />}
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ lineHeight: 1.3, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.08em", marginBottom: 4 }}>
                      {String(i + 1).padStart(2, "0")} · {t.type.toUpperCase()}
                    </div>
                    <div style={{ fontWeight: 500, fontSize: 14, letterSpacing: "-0.01em", color: "var(--ink)" }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.subject}
                    </div>
                  </div>
                  <span className={"chip" + (on ? " accent" : "")}>
                    <span className="chip-dot" />
                    {t.type === "docx" ? "DOCX" : "Plain"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div>
          {current ? (
            <div className="panel" style={{ overflow: "hidden" }}>
              <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--line)", background: "var(--paper-2)" }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Preview · {current.type}</div>
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16 }}>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                    {current.name}
                  </h3>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn" onClick={() => handleEdit(current)}>Edit</button>
                    <button className="btn" onClick={() => handleDelete(current.id)} style={{ color: "var(--danger)" }}>Delete</button>
                  </div>
                </div>
              </div>

              <div style={{
                padding: "18px 28px", borderBottom: "1px solid var(--line)",
                display: "grid", gridTemplateColumns: "80px 1fr", gap: "8px 18px",
                fontSize: 13, alignItems: "baseline",
              }}>
                <span className="eyebrow" style={{ fontSize: 10 }}>Subject</span>
                <span style={{ color: "var(--ink)" }}>
                  <TemplateLine text={current.subject} />
                </span>
                <span className="eyebrow" style={{ fontSize: 10 }}>Format</span>
                <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>
                  {current.type === "docx" ? "Microsoft Word (.docx, rendered to HTML on send)" : "Plain text with line-wrapping"}
                </span>
              </div>

              <div style={{ padding: 28, background: "var(--paper)", minHeight: 280 }}>
                {current.type === "plain" ? (
                  <div className="editor">
                    <TemplateLine text={current.body || "(empty body)"} />
                  </div>
                ) : (
                  <div className="diag" style={{
                    padding: "36px 20px",
                    border: "1px dashed var(--line-2)",
                    borderRadius: "var(--radius)",
                    textAlign: "center",
                    color: "var(--ink-3)",
                  }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"
                         style={{ marginBottom: 10, color: "var(--ink-3)" }}>
                      <path d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink-2)", marginBottom: 4 }}>
                      Formatted .docx template
                    </div>
                    <div className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-4)" }}>
                      RENDERED AT SEND TIME
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--ink-4)" }}>
              Select a template
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="scrim" onClick={resetForm}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ width: "min(720px, 100%)", padding: 28 }}>
            <div className="eyebrow">{editing ? "Edit template" : "New template"}</div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 40, margin: "10px 0 22px", fontWeight: 400, lineHeight: 1 }}>
              <em>{editing ? editing.name : "Draft a message"}</em>
            </h3>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
              <div style={{
                display: "inline-flex", gap: 2, padding: 3,
                background: "var(--paper-2)", borderRadius: "var(--radius)",
                width: "fit-content", border: "1px solid var(--line)",
              }}>
                {(["plain", "docx"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className="btn"
                    style={{
                      padding: "6px 14px",
                      background: form.type === t ? "var(--paper)" : "transparent",
                      border: form.type === t ? "1px solid var(--line-2)" : "1px solid transparent",
                      fontSize: 12,
                    }}
                  >
                    {t === "plain" ? "Plain text" : "Upload .docx"}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Labeled label="Name">
                  <input className="field" required value={form.name}
                         onChange={(e) => setForm({ ...form, name: e.target.value })}
                         placeholder="Speaker outreach — v3" />
                </Labeled>
                <Labeled label="Subject line">
                  <input className="field" required value={form.subject}
                         onChange={(e) => setForm({ ...form, subject: e.target.value })}
                         placeholder="Hi {{name}}, …" />
                </Labeled>
              </div>

              {form.type === "plain" ? (
                <Labeled label="Body">
                  <textarea
                    className="field mono"
                    rows={10}
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    placeholder={"Hi {{name}},\n\n…"}
                    style={{ fontSize: 12.5, lineHeight: 1.7, resize: "vertical" }}
                  />
                </Labeled>
              ) : (
                <Labeled label="Upload .docx">
                  <label className="diag" style={{
                    display: "block", cursor: "pointer",
                    border: "1px dashed var(--line-2)",
                    borderRadius: "var(--radius)",
                    padding: 28, textAlign: "center", color: "var(--ink-3)",
                  }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
                      {file ? file.name : "Drop a .docx here"}
                    </div>
                    <div className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-4)", marginTop: 4 }}>
                      OR CLICK TO BROWSE
                    </div>
                    <input type="file" accept=".docx"
                           style={{ display: "none" }}
                           onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label>
                </Labeled>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                <button type="button" className="btn" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save changes" : "Create template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
