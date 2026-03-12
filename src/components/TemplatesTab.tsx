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
  const [form, setForm] = useState({
    name: "",
    subject: "",
    body: "",
    type: "plain" as "plain" | "docx",
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { showToast, ToastComponent } = useToast();
  const hasFetched = useRef(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch {
      // silently fail on initial load
    } finally {
      setLoading(false);
    }
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
    if (form.type === "plain") {
      formData.append("body", form.body);
    }
    if (form.type === "docx" && file) {
      formData.append("file", file);
    }

    try {
      const res = await fetch("/api/templates", {
        method: editing ? "PUT" : "POST",
        body: formData,
      });

      if (res.ok) {
        showToast(editing ? "Template updated" : "Template created");
        resetForm();
        fetchTemplates();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save", "error");
      }
    } catch {
      showToast("Failed to save template", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;

    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Template deleted");
        fetchTemplates();
      } else {
        showToast("Failed to delete", "error");
      }
    } catch {
      showToast("Failed to delete template", "error");
    }
  };

  const handleEdit = (template: Template) => {
    setEditing(template);
    setForm({
      name: template.name,
      subject: template.subject,
      body: template.body || "",
      type: template.type,
    });
    setShowForm(true);
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setUploading(true);

    // Use the filename (without extension) as the template name
    const templateName = selectedFile.name.replace(/\.docx$/i, "");

    const formData = new FormData();
    formData.append("name", templateName);
    formData.append("subject", templateName);
    formData.append("type", "docx");
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        showToast(`Uploaded "${selectedFile.name}"`);
        fetchTemplates();
      } else {
        const err = await res.json();
        showToast(err.error || "Upload failed", "error");
      }
    } catch {
      showToast("Upload failed", "error");
    } finally {
      setUploading(false);
    }
    e.target.value = "";
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

      {/* Variable Reference */}
      <div className="border border-[#E5E5E5] rounded-lg p-4 mb-6 bg-[#FAFAFA]">
        <p className="text-sm font-medium text-[#525252] mb-2">
          Available Template Variables
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            "{{name}}",
            "{{email}}",
            "{{company}}",
            "{{phoneNumber}}",
            "{{address}}",
          ].map((v) => (
            <code
              key={v}
              className="bg-white border border-[#E5E5E5] rounded px-2 py-1 text-xs text-[#525252]"
            >
              {v}
            </code>
          ))}
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Templates</h2>
        <div className="flex gap-2">
          <label className={`border border-black text-black rounded-md px-4 py-2 font-medium text-sm hover:bg-[#F5F5F5] transition-colors cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            {uploading ? "Uploading..." : "Upload DOCX"}
            <input
              type="file"
              accept=".docx"
              onChange={handleQuickUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="bg-black text-white rounded-md px-4 py-2 font-medium text-sm hover:bg-[#171717] transition-colors"
          >
            New Template
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="border border-[#E5E5E5] rounded-lg p-6 mb-6 bg-white shadow-sm">
          <h3 className="text-lg font-semibold mb-4">
            {editing ? "Edit Template" : "New Template"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type Toggle */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="plain"
                  checked={form.type === "plain"}
                  onChange={() => setForm({ ...form, type: "plain" })}
                  className="accent-[#171717]"
                />
                Plain Text
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="docx"
                  checked={form.type === "docx"}
                  onChange={() => setForm({ ...form, type: "docx" })}
                  className="accent-[#171717]"
                />
                DOCX Upload
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name *
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
                  Subject Line *
                </label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-gray-400 focus:outline-none"
                />
              </div>
            </div>

            {form.type === "plain" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={8}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-gray-400 focus:outline-none font-mono"
                  placeholder="Hi {{name}},&#10;&#10;Thank you for your time..."
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload .docx File
                </label>
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-[#F5F5F5] file:text-[#525252]"
                />
              </div>
            )}

            <div className="flex gap-2 justify-end">
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
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-3">
        {templates.length === 0 ? (
          <div className="text-center py-8 text-[#A3A3A3] text-sm border border-[#E5E5E5] rounded-lg">
            No templates yet. Create your first template above.
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="border border-[#E5E5E5] rounded-lg p-4 bg-white shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">{template.name}</h4>
                    <span className="text-xs bg-[#F5F5F5] text-[#525252] px-2 py-0.5 rounded">
                      {template.type === "docx" ? "DOCX" : "Plain Text"}
                    </span>
                  </div>
                  <p className="text-sm text-[#525252]">
                    Subject: {template.subject}
                  </p>
                  {template.type === "plain" && template.body && (
                    <p className="text-xs text-[#A3A3A3] mt-1 truncate max-w-lg">
                      {template.body}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(template)}
                    className="text-[#64748B] hover:text-[#171717] text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="text-[#A3A3A3] hover:text-red-600 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
