import type { Contact } from "@/types";

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

const VARIABLE_MAP: Record<string, keyof Contact> = {
  name: "name",
  email: "email",
  company: "company",
};

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Normalizes template variables that may be split across HTML tags.
 * Word/DOCX often splits {{name}} into multiple runs, producing HTML like:
 *   <span>{{</span><span>name</span><span>}}</span>
 * This collapses them back into clean {{variable}} patterns so
 * substituteVariables can find them.
 */
export function normalizeTemplateVariables(html: string): string {
  // Match {{ ... }} where HTML tags may appear between any characters.
  // Inner group captures word chars potentially interspersed with tags.
  const pattern =
    /\{(?:<[^>]*>)*\{((?:(?:<[^>]*>)*\w)+(?:<[^>]*>)*)\}(?:<[^>]*>)*\}/g;

  return html.replace(pattern, (_match, inner: string) => {
    const varName = inner.replace(/<[^>]*>/g, "");
    return `{{${varName}}}`;
  });
}

export function substituteVariables(
  template: string,
  contact: Contact,
  isHtml: boolean = true
): string {
  // For HTML content, first normalize variables that may span multiple tags
  const normalized = isHtml ? normalizeTemplateVariables(template) : template;

  return normalized.replace(VARIABLE_PATTERN, (match, varName) => {
    const field = VARIABLE_MAP[varName];
    if (!field) return match;
    const value = (contact[field] as string) || "";
    return isHtml ? escapeHtml(value) : value;
  });
}

export function plainTextToHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(/\n/g, "<br>");
}

/**
 * Format a date string in America/Chicago timezone.
 */
export function formatChicagoDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}
