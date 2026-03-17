import { google, sheets_v4 } from "googleapis";
import { supabaseAdmin } from "./supabase";
import { formatChicagoDate } from "./template-utils";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

const MASTER_HEADERS = [
  "Name",
  "Email",
  "Company",
  "Assigned To",
  "Last Email Sent",
  "Last Email Subject",
  "Sent By",
];

const PERSON_HEADERS = [
  "Name",
  "Email",
  "Company",
  "Last Email Sent",
  "Last Email Subject",
  "Sent By",
];

// Columns 0-3 are editable on master (Name, Email, Company, Assigned To); rest read-only
const MASTER_EDITABLE_COL_COUNT = 4;
const MASTER_SHEET_NAME = "Master";

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
 * Get all existing sheet tabs in the spreadsheet.
 */
async function getExistingSheets(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<Map<string, number>> {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const map = new Map<string, number>();
  for (const sheet of res.data.sheets || []) {
    const title = sheet.properties?.title;
    const id = sheet.properties?.sheetId;
    if (title != null && id != null) {
      map.set(title, id);
    }
  }
  return map;
}

/**
 * Ensure the Master sheet exists. Renames "Sheet1" if it exists.
 */
async function ensureMasterSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<void> {
  const existingSheets = await getExistingSheets(sheets, spreadsheetId);

  if (existingSheets.has(MASTER_SHEET_NAME)) {
    // Master already exists, check headers
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${MASTER_SHEET_NAME}'!A1:G1`,
    });
    if (!res.data.values || res.data.values.length === 0) {
      await writeHeadersAndFormat(sheets, spreadsheetId, MASTER_SHEET_NAME, MASTER_HEADERS, existingSheets.get(MASTER_SHEET_NAME)!);
    }
    return;
  }

  // If "Sheet1" exists, rename it to "Master"
  if (existingSheets.has("Sheet1")) {
    const sheet1Id = existingSheets.get("Sheet1")!;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheet1Id,
                title: MASTER_SHEET_NAME,
              },
              fields: "title",
            },
          },
        ],
      },
    });
    await writeHeadersAndFormat(sheets, spreadsheetId, MASTER_SHEET_NAME, MASTER_HEADERS, sheet1Id);
    return;
  }

  // Create Master sheet
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: MASTER_SHEET_NAME },
          },
        },
      ],
    },
  });
  const newSheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
  await writeHeadersAndFormat(sheets, spreadsheetId, MASTER_SHEET_NAME, MASTER_HEADERS, newSheetId);
}

/**
 * Ensure a person's sheet tab exists. Returns false if it didn't exist (no auto-create).
 */
async function ensurePersonSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  personName: string,
  existingSheets: Map<string, number>
): Promise<number> {
  if (existingSheets.has(personName)) {
    return existingSheets.get(personName)!;
  }

  // Create the sheet
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: personName },
          },
        },
      ],
    },
  });

  const sheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
  await writeHeadersAndFormat(sheets, spreadsheetId, personName, PERSON_HEADERS, sheetId);
  return sheetId;
}

async function writeHeadersAndFormat(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  sheetId: number
): Promise<void> {
  const colLetter = String.fromCharCode(64 + headers.length); // A=65

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1:${colLetter}1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [headers],
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
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
              sheetId,
              gridProperties: { frozenRowCount: 1 },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    },
  });
}

/**
 * Fetch all users from Supabase.
 */
async function getAllUsers(): Promise<Map<string, { id: string; name: string }>> {
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, name, email");

  const map = new Map<string, { id: string; name: string }>();
  if (users) {
    for (const u of users) {
      // Map by name and by ID for lookup flexibility
      if (u.name) {
        map.set(u.name, { id: u.id, name: u.name });
      }
    }
  }
  return map;
}

/**
 * Push all contacts from Supabase to the Google Sheet.
 * Updates Master sheet and per-person sheets.
 */
export async function pushContactsToSheet(): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  await ensureMasterSheet(sheets, spreadsheetId);

  // Fetch contacts
  const { data: contacts, error: contactsError } = await supabaseAdmin
    .from("contacts")
    .select("*")
    .order("name", { ascending: true });

  if (contactsError) {
    console.error("Failed to fetch contacts for sheet sync:", contactsError);
    return;
  }

  // Fetch all users for name resolution
  const { data: allUsers } = await supabaseAdmin
    .from("users")
    .select("id, name");

  const userIdToName = new Map<string, string>();
  if (allUsers) {
    for (const u of allUsers) {
      if (u.name) userIdToName.set(u.id, u.name);
    }
  }

  // Fetch last email tracking per contact (with sender info)
  const contactIds = contacts.map((c) => c.id);
  const { data: tracking } = await supabaseAdmin
    .from("email_tracking")
    .select("contact_id, sent_at, subject, sent_by")
    .in("contact_id", contactIds.length > 0 ? contactIds : ["none"])
    .order("sent_at", { ascending: false });

  const lastSentMap = new Map<
    string,
    { sent_at: string; subject: string; sent_by_name: string }
  >();
  if (tracking) {
    for (const t of tracking) {
      if (!lastSentMap.has(t.contact_id)) {
        lastSentMap.set(t.contact_id, {
          sent_at: t.sent_at,
          subject: t.subject,
          sent_by_name: t.sent_by ? (userIdToName.get(t.sent_by) || "") : "",
        });
      }
    }
  }

  // Build master rows
  const masterRows = contacts.map((c) => {
    const lastSent = lastSentMap.get(c.id);
    const assignedName = c.assigned_to
      ? userIdToName.get(c.assigned_to) || ""
      : "";
    return [
      c.name || "",
      c.email || "",
      c.company || "",
      assignedName,
      lastSent ? formatChicagoDate(lastSent.sent_at) : "",
      lastSent?.subject || "",
      lastSent?.sent_by_name || "",
    ];
  });

  // Clear master data rows and write
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${MASTER_SHEET_NAME}'!A2:G`,
  });

  if (masterRows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${MASTER_SHEET_NAME}'!A2:G${masterRows.length + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: masterRows },
    });
  }

  // Build per-person sheets
  const personContacts = new Map<string, typeof contacts>();
  for (const c of contacts) {
    if (c.assigned_to) {
      const personName = userIdToName.get(c.assigned_to);
      if (personName) {
        if (!personContacts.has(personName)) {
          personContacts.set(personName, []);
        }
        personContacts.get(personName)!.push(c);
      }
    }
  }

  // Update per-person sheets
  const existingSheets = await getExistingSheets(sheets, spreadsheetId);

  for (const [personName, pContacts] of personContacts) {
    const sheetId = await ensurePersonSheet(
      sheets,
      spreadsheetId,
      personName,
      existingSheets
    );
    // Update existingSheets map for next iteration
    existingSheets.set(personName, sheetId);

    const personRows = pContacts.map((c) => {
      const lastSent = lastSentMap.get(c.id);
      return [
        c.name || "",
        c.email || "",
        c.company || "",
        lastSent ? formatChicagoDate(lastSent.sent_at) : "",
        lastSent?.subject || "",
        lastSent?.sent_by_name || "",
      ];
    });

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${personName}'!A2:F`,
    });

    if (personRows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${personName}'!A2:F${personRows.length + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: personRows },
      });
    }
  }
}

/**
 * Pull contacts from the Master Google Sheet and sync into Supabase.
 * Upserts rows based on email match. Deletes contacts removed from the sheet.
 * Returns sync stats.
 */
export async function pullContactsFromSheet(
  userId: string
): Promise<{ inserted: number; updated: number; deleted: number }> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  await ensureMasterSheet(sheets, spreadsheetId);

  // Read all data rows from Master (skip header) — editable columns: Name, Email, Company, Assigned To
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${MASTER_SHEET_NAME}'!A2:D`,
  });

  const sheetRows = res.data.values || [];

  // Fetch all users for name → ID resolution
  const usersByName = await getAllUsers();

  // Parse sheet rows
  const sheetContacts: Array<{
    name: string;
    email: string;
    company: string | null;
    assigned_to: string | null;
  }> = [];

  const sheetEmails = new Set<string>();

  for (const row of sheetRows) {
    const name = (row[0] || "").toString().trim();
    const email = (row[1] || "").toString().trim();
    if (!name || !email) continue;

    const assignedToName = (row[3] || "").toString().trim();
    let assignedToId: string | null = null;
    if (assignedToName) {
      const user = usersByName.get(assignedToName);
      if (user) assignedToId = user.id;
    }

    sheetEmails.add(email);
    sheetContacts.push({
      name,
      email,
      company: (row[2] || "").toString().trim() || null,
      assigned_to: assignedToId,
    });
  }

  // Fetch existing contacts from Supabase
  const { data: existingContacts } = await supabaseAdmin
    .from("contacts")
    .select("id, email, name, company, assigned_to");

  const existingMap = new Map<
    string,
    {
      id: string;
      name: string;
      company: string | null;
      assigned_to: string | null;
    }
  >();
  if (existingContacts) {
    for (const c of existingContacts) {
      existingMap.set(c.email, {
        id: c.id,
        name: c.name,
        company: c.company,
        assigned_to: c.assigned_to,
      });
    }
  }

  let inserted = 0;
  let updated = 0;

  for (const contact of sheetContacts) {
    const existing = existingMap.get(contact.email);
    if (existing) {
      const changed =
        existing.name !== contact.name ||
        (existing.company || null) !== (contact.company || null) ||
        (existing.assigned_to || null) !== (contact.assigned_to || null);

      if (changed) {
        await supabaseAdmin
          .from("contacts")
          .update({
            name: contact.name,
            company: contact.company,
            assigned_to: contact.assigned_to,
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
