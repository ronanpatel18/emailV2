"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Contact, Template, User, Attachment } from "@/types";
import { Spinner } from "./Spinner";
import { useToast } from "./Toast";
import { SectionHead, Step, TemplateLine, initials, fmtAgo, fmtKB, useReveal } from "./wsbc-ui";
import { substituteVariables } from "@/lib/template-utils";
import { useSession } from "next-auth/react";

interface SendEmailsTabProps {
  users: User[];
  selectedUserId: string;
  onChangeUserId: (id: string) => void;
}

export function SendEmailsTab({ users, selectedUserId, onChangeUserId }: SendEmailsTabProps) {
  const { data: session } = useSession();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [senderTitle, setSenderTitle] = useState<string>("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [attSel, setAttSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { showToast, ToastComponent } = useToast();
  const hasFetched = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useReveal(contacts.length);

  const fetchData = useCallback(async () => {
    try {
      const [tRes, cRes, aRes, meRes] = await Promise.all([
        fetch("/api/templates"),
        fetch("/api/contacts"),
        fetch("/api/attachments"),
        fetch("/api/users/me").catch(() => null),
      ]);
      if (tRes.ok) setTemplates(await tRes.json());
      if (cRes.ok) setContacts(await cRes.json());
      if (aRes.ok) setAttachments(await aRes.json());
      if (meRes && meRes.ok) {
        const me = await meRes.json();
        if (me?.title) setSenderTitle(me.title);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchData();
  }, [fetchData]);

  const hasPersonal = selectedUserId ? contacts.some((c) => c.assigned_to === selectedUserId) : false;
  const display = selectedUserId && hasPersonal ? contacts.filter((c) => c.assigned_to === selectedUserId) : contacts;
  const filtered = q
    ? display.filter((c) =>
        [c.name, c.email, c.company].filter(Boolean).some((s) => (s as string).toLowerCase().includes(q.toLowerCase()))
      )
    : display;

  const tmpl = templates.find((t) => t.id === templateId);
  const previewContact = Array.from(sel).map((id) => contacts.find((c) => c.id === id)).filter(Boolean)[0] as Contact | undefined;

  const toggle = (id: string) => {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  };
  const toggleAll = () => {
    if (sel.size === filtered.length) setSel(new Set());
    else setSel(new Set(filtered.map((c) => c.id)));
  };
  const toggleAtt = (id: string) => {
    const n = new Set(attSel);
    n.has(id) ? n.delete(id) : n.add(id);
    setAttSel(n);
  };

  const handleUploadPDFs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("files", f);
      const res = await fetch("/api/attachments", { method: "POST", body: fd });
      if (res.ok) {
        const uploaded: Attachment[] = await res.json();
        setAttachments((prev) => [...uploaded, ...prev]);
        const n = new Set(attSel);
        for (const a of uploaded) n.add(a.id);
        setAttSel(n);
        showToast(`${uploaded.length} PDF(s) uploaded`);
      } else { const err = await res.json(); showToast(err.error || "Upload failed", "error"); }
    } catch { showToast("Failed to upload PDFs", "error"); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const removeAtt = async (id: string) => {
    try {
      const res = await fetch(`/api/attachments?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
        const n = new Set(attSel); n.delete(id); setAttSel(n);
        showToast("Attachment removed");
      }
    } catch { showToast("Failed to remove", "error"); }
  };

  const canSend = !!templateId && sel.size > 0 && !sending;

  const doSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      const res = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          contactIds: Array.from(sel),
          attachmentIds: attSel.size > 0 ? Array.from(attSel) : undefined,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`Sent: ${result.success} success, ${result.failed} failed`);
        setSel(new Set());
      } else { const err = await res.json(); showToast(err.error || "Send failed", "error"); }
    } catch { showToast("Failed to send emails", "error"); }
    finally { setSending(false); }
  };

  const senderCtx = useMemo(
    () => ({
      name: session?.user?.name || "",
      email: session?.user?.email || "",
      title: senderTitle || "",
    }),
    [session?.user?.name, session?.user?.email, senderTitle]
  );

  const renderedSubject = useMemo(
    () =>
      tmpl && previewContact
        ? substituteVariables(tmpl.subject, previewContact, false, senderCtx)
        : "",
    [tmpl, previewContact, senderCtx]
  );
  const renderedBody = useMemo(() => {
    if (!tmpl || !previewContact) return "";
    if (tmpl.type === "docx") return "— .docx template will be rendered at send time —";
    return substituteVariables(tmpl.body || "", previewContact, false, senderCtx);
  }, [tmpl, previewContact, senderCtx]);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}><Spinner /></div>;
  }

  return (
    <div>
      {ToastComponent}

      <SectionHead
        no="§ 03"
        eyebrow="Dispatch"
        title="Send"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="eyebrow" style={{ fontSize: 10 }}>View</span>
            <select className="field" value={selectedUserId} onChange={(e) => onChangeUserId(e.target.value)} style={{ width: "auto", minWidth: 160 }}>
              <option value="">Master</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          </div>
        }
      />

      {/* stepper */}
      <div
        className="reveal"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 0,
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <Step n="01" label="Template" value={tmpl ? tmpl.name : "Not selected"} done={!!tmpl} />
        <Step n="02" label="Recipients" value={sel.size > 0 ? `${sel.size} selected` : "0 selected"} done={sel.size > 0} />
        <Step n="03" label="Attachments" value={attSel.size > 0 ? `${attSel.size} PDFs` : "None"} done={attSel.size > 0} optional />
      </div>

      {/* workspace */}
      <div
        className="reveal"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(300px, 360px) minmax(0, 1fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* LEFT */}
        <div style={{ display: "grid", gap: 20, alignContent: "start", minWidth: 0 }}>
          <div className="panel" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Template</div>
            <select className="field" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Choose a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} · {t.type.toUpperCase()}</option>
              ))}
            </select>
            {tmpl && (
              <div style={{ marginTop: 12, padding: 12, background: "var(--paper-2)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
                <div className="eyebrow" style={{ fontSize: 10 }}>Subject</div>
                <div style={{ fontSize: 13, marginTop: 4, color: "var(--ink-2)" }}>
                  <TemplateLine text={tmpl.subject} />
                </div>
              </div>
            )}
          </div>

          <div className="panel" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="eyebrow">PDF Attachments</span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
                {attSel.size}/{attachments.length}
              </span>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {uploading ? "Uploading…" : "Upload PDFs"}
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={handleUploadPDFs} />
            {attachments.length === 0 ? (
              <div style={{ textAlign: "center", padding: 14, fontSize: 12, color: "var(--ink-4)" }}>None uploaded</div>
            ) : (
              <div style={{ display: "grid", gap: 4 }}>
                {attachments.map((a) => {
                  const on = attSel.has(a.id);
                  return (
                    <label key={a.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                      background: on ? "var(--paper-2)" : "transparent",
                      border: on ? "1px solid var(--line-2)" : "1px solid transparent",
                      transition: "all 120ms ease",
                    }}>
                      <input type="checkbox" className="ck" checked={on} onChange={() => toggleAtt(a.id)} />
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.file_name}
                      </span>
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{fmtKB(a.size_bytes)}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); removeAtt(a.id); }}
                        className="btn btn-ghost"
                        style={{ padding: "2px 6px", fontSize: 12, color: "var(--ink-4)" }}
                        title="Remove"
                      >✕</button>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {tmpl && previewContact && (
            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{
                padding: "12px 16px", borderBottom: "1px solid var(--line)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "var(--paper-2)",
              }}>
                <span className="eyebrow">Preview — as {previewContact.name.split(" ")[0]}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>1 / {sel.size}</span>
              </div>
              <div style={{ padding: 16, fontSize: 12.5 }}>
                <div style={{ fontWeight: 500, marginBottom: 6, color: "var(--ink)" }}>{renderedSubject}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)", marginBottom: 10 }}>
                  To: {previewContact.email}
                </div>
                <div className="editor" style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ink-2)" }}>{renderedBody}</div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — recipients */}
        <div className="panel" style={{ overflow: "hidden", minWidth: 0 }}>
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid var(--line)",
            background: "var(--paper-2)", display: "flex", alignItems: "center", gap: 12,
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                className="ck"
                checked={sel.size === filtered.length && filtered.length > 0}
                onChange={toggleAll}
              />
              <span className="eyebrow" style={{ fontSize: 10 }}>
                {sel.size === filtered.length && filtered.length > 0 ? "Deselect all" : "Select all"}
              </span>
            </label>
            <div className="hairline-vert" style={{ height: 18 }} />
            <input
              className="field"
              placeholder="Filter recipients…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ flex: 1, maxWidth: 320, background: "var(--paper)", padding: "7px 10px" }}
            />
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.06em" }}>
                {sel.size} / {filtered.length}
              </span>
            </div>
          </div>

          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                No recipients available
              </div>
            ) : filtered.map((c) => {
              const on = sel.has(c.id);
              return (
                <label key={c.id} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 18px",
                  borderTop: "1px solid var(--line)",
                  cursor: "pointer",
                  background: on ? "var(--paper-2)" : "var(--paper)",
                  transition: "background 120ms ease",
                }}>
                  <input type="checkbox" className="ck" checked={on} onChange={() => toggle(c.id)} />
                  <div className="avatar">{initials(c.name)}</div>
                  <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontWeight: 500, fontSize: 13.5, color: "var(--ink)" }}>{c.name}</span>
                      {c.company && <span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>· {c.company}</span>}
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.02em" }}>{c.email}</span>
                  </div>
                  {c.last_sent_at && (
                    <span className="chip" title={`Last sent ${fmtAgo(c.last_sent_at)}`}>
                      <span className="chip-dot" style={{ background: "var(--success)" }} />
                      Sent {fmtAgo(c.last_sent_at)}
                    </span>
                  )}
                  {on && (
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--ink)", letterSpacing: "0.06em" }}>✓</span>
                  )}
                </label>
              );
            })}
          </div>

          <div style={{
            padding: "16px 18px", borderTop: "1px solid var(--line)",
            background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
              {sel.size === 0 ? (
                <>Select recipients to continue</>
              ) : (
                <>
                  Sending <strong style={{ color: "var(--ink)" }}>{sel.size}</strong> email{sel.size !== 1 ? "s" : ""}
                  {attSel.size > 0 && (
                    <> · <strong style={{ color: "var(--ink)" }}>{attSel.size}</strong> attachment{attSel.size !== 1 ? "s" : ""}</>
                  )}
                  {tmpl && <> via <em style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{tmpl.name}</em></>}
                </>
              )}
            </div>
            <button
              className="btn btn-primary"
              disabled={!canSend}
              onClick={() => setConfirmOpen(true)}
              style={{ padding: "10px 18px" }}
            >
              {sending ? "Sending…" : (
                <>
                  Send {sel.size > 0 ? `to ${sel.size}` : "emails"}
                  <span style={{ opacity: 0.6, marginLeft: 4 }}>→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="scrim" onClick={() => setConfirmOpen(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ width: "min(480px, 100%)", padding: 28 }}>
            <div className="eyebrow">Confirm send</div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 40, margin: "10px 0 14px", fontWeight: 400, lineHeight: 1 }}>
              Send to <em>{sel.size}</em>?
            </h3>
            <p style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.55, marginTop: 0 }}>
              Emails will be queued via Microsoft Graph immediately. Each contact's row will update with a timestamp.
              {attSel.size > 0 && ` Includes ${attSel.size} PDF attachment${attSel.size !== 1 ? "s" : ""}.`}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button className="btn" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={doSend}>Yes, send now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
