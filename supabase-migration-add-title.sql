-- Adds the `title` column used to display each member's title from the
-- "WSBC Members" Google Sheet next to their name on the Contacts tab.
ALTER TABLE users ADD COLUMN IF NOT EXISTS title text;
