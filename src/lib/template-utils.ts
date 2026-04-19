import type { Contact } from "@/types";

// Case-insensitive variable pattern (subject + body share this)
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export interface SenderContext {
  name?: string | null;
  title?: string | null;
  email?: string | null;
}

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
 * or bold-fragment variants like:
 *   <b>{{</b>name<b>}}</b>
 * This collapses them back into clean {{variable}} patterns so substitution works,
 * and also ensures surrounding whitespace/bold formatting is preserved.
 */
export function normalizeTemplateVariables(html: string): string {
  // Collapse `{{ ... }}` spans broken across tags — inner content may be split
  // across tags and contain optional whitespace.
  const pattern =
    /\{(?:<[^>]*>|\s)*\{((?:(?:<[^>]*>|\s)*[A-Za-z0-9_])+(?:<[^>]*>|\s)*)\}(?:<[^>]*>|\s)*\}/g;

  let out = html.replace(pattern, (_match, inner: string) => {
    // Strip tags AND whitespace from inside the variable name itself
    const varName = inner.replace(/<[^>]*>/g, "").replace(/\s+/g, "");
    return `{{${varName}}}`;
  });

  // Clean up empty bold/italic tags left after collapse:
  //   <b></b>, <strong> </strong>, <i></i>
  out = out.replace(/<(b|strong|i|em|u|span)[^>]*>\s*<\/\1>/gi, "");

  return out;
}

/**
 * Substitute {{variable}} placeholders — case-insensitive — with values from
 * the contact and optional sender context. Preserves surrounding whitespace.
 */
export function substituteVariables(
  template: string,
  contact: Contact,
  isHtml: boolean = true,
  sender?: SenderContext
): string {
  const normalized = isHtml ? normalizeTemplateVariables(template) : template;

  const lookup = (rawName: string): string | null => {
    const name = rawName.toLowerCase();
    switch (name) {
      case "name":
      case "recipient":
      case "recipient_name":
        return contact.name || "";
      case "email":
      case "recipient_email":
        return contact.email || "";
      case "company":
      case "organization":
      case "org":
        return contact.company || "";
      case "sender":
      case "sender_name":
      case "from":
      case "signature":
        return sender?.name ?? "";
      case "title":
      case "sender_title":
      case "role":
        return sender?.title ?? "";
      case "sender_email":
        return sender?.email ?? "";
      default:
        return null;
    }
  };

  return normalized.replace(VARIABLE_PATTERN, (match, varName: string) => {
    const value = lookup(varName);
    if (value === null) return match; // unknown var — leave untouched
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
