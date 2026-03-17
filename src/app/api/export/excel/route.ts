import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import ExcelJS from "exceljs";
import { formatChicagoDate } from "@/lib/template-utils";

export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get contacts
  const { data: contacts, error: contactsError } = await supabaseAdmin
    .from("contacts")
    .select("*")
    .order("name", { ascending: true });

  if (contactsError) {
    return NextResponse.json(
      { error: contactsError.message },
      { status: 500 }
    );
  }

  // Get all users for name resolution
  const { data: allUsers } = await supabaseAdmin
    .from("users")
    .select("id, name");

  const userIdToName = new Map<string, string>();
  if (allUsers) {
    for (const u of allUsers) {
      if (u.name) userIdToName.set(u.id, u.name);
    }
  }

  // Get last email tracking per contact
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
          sent_by_name: t.sent_by
            ? userIdToName.get(t.sent_by) || ""
            : "",
        });
      }
    }
  }

  // Build Excel
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Contacts");

  worksheet.columns = [
    { header: "Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Company", key: "company", width: 25 },
    { header: "Assigned To", key: "assigned_to", width: 20 },
    { header: "Last Email Sent", key: "last_sent", width: 22 },
    { header: "Last Email Subject", key: "last_subject", width: 35 },
    { header: "Sent By", key: "sent_by", width: 20 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5F5F5" },
  };

  for (const contact of contacts) {
    const lastSent = lastSentMap.get(contact.id);
    worksheet.addRow({
      name: contact.name,
      email: contact.email,
      company: contact.company || "",
      assigned_to: contact.assigned_to
        ? userIdToName.get(contact.assigned_to) || ""
        : "",
      last_sent: lastSent ? formatChicagoDate(lastSent.sent_at) : "",
      last_subject: lastSent?.subject || "",
      sent_by: lastSent?.sent_by_name || "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="contacts-${
        new Date().toISOString().split("T")[0]
      }.xlsx"`,
    },
  });
}
