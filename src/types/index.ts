export interface User {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_sent_at?: string | null;
  last_subject?: string | null;
  last_sent_by_name?: string | null;
  assigned_to_name?: string | null;
}

export interface Template {
  id: string;
  name: string;
  subject: string;
  body: string | null;
  type: "plain" | "docx";
  docx_storage_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTracking {
  id: string;
  contact_id: string;
  template_id: string | null;
  sent_by: string | null;
  sent_at: string;
  subject: string | null;
  message_id: string | null;
  conversation_id: string | null;
  replied_at: string | null;
  reminder_sent_at: string | null;
}

export interface Attachment {
  id: string;
  file_name: string;
  storage_path: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface AccessGroup {
  id: string;
  name: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: "admin" | "member";
}
