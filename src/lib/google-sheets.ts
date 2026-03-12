import { google, sheets_v4 } from "googleapis";
import { supabaseAdmin } from "./supabase";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

const HEADERS = [
  "Name",
  "Email",
  "Company",
  "Phone Number",
  "Address",
  "Last Email Sent",
  "Last Email Subject",
];

// Columns 0-4 are editable contact fields; 5-6 are read-only tracking data
const EDITABLE_COL_COUNT = 5;

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY must be set"
    );
  }
  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });
}

function getSheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function getSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) {
    throw new Error("GOOGLE_SHEET_ID must be set");
  }
  return id;
}

/**
 * Returns the URL to open the Google Sheet in a browser.
 */
export function getSheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${getSheetId()}/edit`;
}

/**
 * Initialize the sheet with headers if empty.
 * Call this once during setup or on first sync.
 */
export async function initializeSheet(): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  // Check if headers exist
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Sheet1!A1:G1",
  });

  if (!res.data.values || res.data.values.length === 0) {
    // Write headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1:G1",
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADERS],
      },
    });

    // Bold + freeze header row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: {
                    red: 0.96,
                    green: 0.96,
                    blue: 0.96,
                  },
                },
              },
              fields: "userEnteredFormat(textFormat,backgroundColor)",
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId: 0,
                gridProperties: { frozenRowCount: 1 },
              },
              fields: "gridProperties.frozenRowCount",
            },
          },
        ],
      },
    });
  }
}

/**
 * Push all contacts from Supabase to the Google Sheet.
 * Clears existing data rows and rewrites them.
 * Preserves the header row.
 */
export async function pushContactsToSheet(): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  // Ensure headers exist
  await initializeSheet();

  // Fetch contacts
  const { data: contacts, error: contactsError } = await supabaseAdmin
    .from("contacts")
    .select("*")
    .order("name", { ascending: true });

  if (contactsError) {
    console.error("Failed to fetch contacts for sheet sync:", contactsError);
    return;
  }

  // Fetch last email tracking per contact
  const contactIds = contacts.map((c) => c.id);
  const { data: tracking } = await supabaseAdmin
    .from("email_tracking")
    .select("contact_id, sent_at, subject")
    .in("contact_id", contactIds.length > 0 ? contactIds : ["none"])
    .order("sent_at", { ascending: false });

  const lastSentMap = new Map<string, { sent_at: string; subject: string }>();
  if (tracking) {
    for (const t of tracking) {
      if (!lastSentMap.has(t.contact_id)) {
        lastSentMap.set(t.contact_id, {
          sent_at: t.sent_at,
          subject: t.subject,
        });
      }
    }
  }

  // Build rows
  const rows = contacts.map((c) => {
    const lastSent = lastSentMap.get(c.id);
    return [
      c.name || "",
      c.email || "",
      c.company || "",
      c.phone_number || "",
      c.address || "",
      lastSent ? new Date(lastSent.sent_at).toLocaleDateString() : "",
      lastSent?.subject || "",
    ];
  });

  // Clear all data rows (keep header)
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: "Sheet1!A2:G",
  });

  // Write new data
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Sheet1!A2:G${rows.length + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: rows,
      },
    });
  }
}

/**
 * Pull contacts from the Google Sheet and sync into Supabase.
 * Upserts rows based on email match. Deletes contacts removed from the sheet.
 * Only reads the editable columns (Name, Email, Company, Phone, Address).
 * Returns sync stats.
 */
export async function pullContactsFromSheet(
  userId: string
): Promise<{ inserted: number; updated: number; deleted: number }> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  // Read all data rows (skip header)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Sheet1!A2:E",
  });

  const sheetRows = res.data.values || [];

  // Parse sheet rows
  const sheetContacts: Array<{
    name: string;
    email: string;
    company: string | null;
    phone_number: string | null;
    address: string | null;
  }> = [];

  const sheetEmails = new Set<string>();

  for (const row of sheetRows) {
    const name = (row[0] || "").toString().trim();
    const email = (row[1] || "").toString().trim();
    if (!name || !email) continue;

    sheetEmails.add(email);
    sheetContacts.push({
      name,
      email,
      company: (row[2] || "").toString().trim() || null,
      phone_number: (row[3] || "").toString().trim() || null,
      address: (row[4] || "").toString().trim() || null,
    });
  }

  // Fetch existing contacts from Supabase
  const { data: existingContacts } = await supabaseAdmin
    .from("contacts")
    .select("id, email, name, company, phone_number, address");

  const existingMap = new Map<
    string,
    {
      id: string;
      name: string;
      company: string | null;
      phone_number: string | null;
      address: string | null;
    }
  >();
  if (existingContacts) {
    for (const c of existingContacts) {
      existingMap.set(c.email, {
        id: c.id,
        name: c.name,
        company: c.company,
        phone_number: c.phone_number,
        address: c.address,
      });
    }
  }

  let inserted = 0;
  let updated = 0;

  for (const contact of sheetContacts) {
    const existing = existingMap.get(contact.email);
    if (existing) {
      // Only update if something actually changed
      const changed =
        existing.name !== contact.name ||
        (existing.company || null) !== (contact.company || null) ||
        (existing.phone_number || null) !== (contact.phone_number || null) ||
        (existing.address || null) !== (contact.address || null);

      if (changed) {
        await supabaseAdmin
          .from("contacts")
          .update({
            name: contact.name,
            company: contact.company,
            phone_number: contact.phone_number,
            address: contact.address,
          })
          .eq("id", existing.id);
        updated++;
      }
      existingMap.delete(contact.email);
    } else {
      await supabaseAdmin.from("contacts").insert({
        ...contact,
        created_by: userId,
      });
      inserted++;
    }
  }

  // Delete contacts that were removed from the sheet
  let deleted = 0;
  for (const [, existing] of existingMap) {
    await supabaseAdmin.from("contacts").delete().eq("id", existing.id);
    deleted++;
  }

  return { inserted, updated, deleted };
}
