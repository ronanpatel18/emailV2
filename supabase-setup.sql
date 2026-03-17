-- ============================================
-- 1. TABLES
-- ============================================

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  refresh_token text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE access_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE group_members (
  group_id uuid REFERENCES access_groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  company text,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text,
  type text CHECK (type IN ('plain', 'docx')) DEFAULT 'plain',
  docx_storage_path text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE email_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  template_id uuid REFERENCES templates(id) ON DELETE SET NULL,
  sent_by uuid REFERENCES users(id),
  sent_at timestamptz DEFAULT now(),
  subject text,
  message_id text,
  conversation_id text,
  replied_at timestamptz,
  reminder_sent_at timestamptz
);

CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  content_type text DEFAULT 'application/pdf',
  size_bytes bigint,
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_name ON contacts(name);
CREATE INDEX idx_contacts_assigned_to ON contacts(assigned_to);
CREATE INDEX idx_email_tracking_contact ON email_tracking(contact_id);
CREATE INDEX idx_email_tracking_sent_by ON email_tracking(sent_by);
CREATE INDEX idx_email_tracking_sent_at ON email_tracking(sent_at);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_attachments_uploaded_by ON attachments(uploaded_by);

-- ============================================
-- 3. AUTO-UPDATE updated_at TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Helper: check if a user is in any group
CREATE OR REPLACE FUNCTION is_group_member(check_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members WHERE user_id = check_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: check if a user is an admin in any group
CREATE OR REPLACE FUNCTION is_group_admin(check_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members WHERE user_id = check_user_id AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Users: can read own row
CREATE POLICY users_select ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (id = auth.uid());

-- Contacts: group members can CRUD
CREATE POLICY contacts_select ON contacts FOR SELECT USING (is_group_member(auth.uid()));
CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK (is_group_member(auth.uid()));
CREATE POLICY contacts_update ON contacts FOR UPDATE USING (is_group_member(auth.uid()));
CREATE POLICY contacts_delete ON contacts FOR DELETE USING (is_group_member(auth.uid()));

-- Templates: group members can CRUD
CREATE POLICY templates_select ON templates FOR SELECT USING (is_group_member(auth.uid()));
CREATE POLICY templates_insert ON templates FOR INSERT WITH CHECK (is_group_member(auth.uid()));
CREATE POLICY templates_update ON templates FOR UPDATE USING (is_group_member(auth.uid()));
CREATE POLICY templates_delete ON templates FOR DELETE USING (is_group_member(auth.uid()));

-- Email tracking: group members can read all, insert own
CREATE POLICY tracking_select ON email_tracking FOR SELECT USING (is_group_member(auth.uid()));
CREATE POLICY tracking_insert ON email_tracking FOR INSERT WITH CHECK (is_group_member(auth.uid()));
CREATE POLICY tracking_update ON email_tracking FOR UPDATE USING (is_group_member(auth.uid()));

-- Attachments: group members can CRUD
CREATE POLICY attachments_select ON attachments FOR SELECT USING (is_group_member(auth.uid()));
CREATE POLICY attachments_insert ON attachments FOR INSERT WITH CHECK (is_group_member(auth.uid()));
CREATE POLICY attachments_delete ON attachments FOR DELETE USING (is_group_member(auth.uid()));

-- Access groups: members can see their groups
CREATE POLICY groups_select ON access_groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM group_members WHERE group_id = access_groups.id AND user_id = auth.uid())
);

-- Group members: members can see their group, admins can manage
CREATE POLICY gm_select ON group_members FOR SELECT USING (user_id = auth.uid() OR is_group_admin(auth.uid()));
CREATE POLICY gm_insert ON group_members FOR INSERT WITH CHECK (is_group_admin(auth.uid()));
CREATE POLICY gm_delete ON group_members FOR DELETE USING (is_group_admin(auth.uid()));

-- ============================================
-- 5. STORAGE POLICIES
-- ============================================

-- Run these after creating the "templates" storage bucket:
CREATE POLICY templates_storage_select ON storage.objects FOR SELECT
USING (bucket_id = 'templates' AND is_group_member(auth.uid()));
CREATE POLICY templates_storage_insert ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'templates' AND is_group_member(auth.uid()));
CREATE POLICY templates_storage_delete ON storage.objects FOR DELETE
USING (bucket_id = 'templates' AND is_group_member(auth.uid()));

-- Run these after creating the "attachments" storage bucket:
CREATE POLICY attachments_storage_select ON storage.objects FOR SELECT
USING (bucket_id = 'attachments' AND is_group_member(auth.uid()));
CREATE POLICY attachments_storage_insert ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'attachments' AND is_group_member(auth.uid()));
CREATE POLICY attachments_storage_delete ON storage.objects FOR DELETE
USING (bucket_id = 'attachments' AND is_group_member(auth.uid()));

-- ============================================
-- 6. SEED DATA (run after first sign-in)
-- ============================================

INSERT INTO access_groups (name) VALUES ('WSBC Team');
INSERT INTO group_members (group_id, user_id, role)
VALUES ('<group-id>', '<your-user-id>', 'admin');
