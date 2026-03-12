import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import ExcelJS from "exceljs";

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

  // Get last email tracking per contact
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

  // Build Excel
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Contacts");

  worksheet.columns = [
    { header: "Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Company", key: "company", width: 25 },
    { header: "Phone Number", key: "phone_number", width: 18 },
    { header: "Address", key: "address", width: 35 },
    { header: "Last Email Sent", key: "last_sent", width: 20 },
    { header: "Last Email Subject", key: "last_subject", width: 35 },
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
      phone_number: contact.phone_number || "",
      address: contact.address || "",
      last_sent: lastSent
        ? new Date(lastSent.sent_at).toLocaleDateString()
        : "",
      last_subject: lastSent?.subject || "",
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
