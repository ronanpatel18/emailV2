import type { Contact } from "@/types";

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

const VARIABLE_MAP: Record<string, keyof Contact> = {
  name: "name",
  email: "email",
  company: "company",
  phoneNumber: "phone_number",
  address: "address",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function substituteVariables(
  template: string,
  contact: Contact,
  isHtml: boolean = true
): string {
  return template.replace(VARIABLE_PATTERN, (match, varName) => {
    const field = VARIABLE_MAP[varName];
    if (!field) return match;
    const value = (contact[field] as string) || "";
    return isHtml ? escapeHtml(value) : value;
  });
}

export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function plainTextToHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(/\n/g, "<br>");
}
