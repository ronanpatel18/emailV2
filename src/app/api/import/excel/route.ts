import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import ExcelJS from "exceljs";
import { pushContactsToSheet } from "@/lib/google-sheets";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { error: "No file uploaded" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return NextResponse.json(
      { error: "No worksheet found in file" },
      { status: 400 }
    );
  }

  // Parse header row to find column indices
  const headerRow = worksheet.getRow(1);
  const headers: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const value = String(cell.value || "").toLowerCase().trim();
    if (value.includes("name") && !value.includes("company")) headers.name = colNumber;
    if (value.includes("email")) headers.email = colNumber;
    if (value.includes("company")) headers.company = colNumber;
    if (value.includes("phone")) headers.phone_number = colNumber;
    if (value.includes("address")) headers.address = colNumber;
  });

  if (!headers.name || !headers.email) {
    return NextResponse.json(
      { error: "Excel must have Name and Email columns" },
      { status: 400 }
    );
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const name = String(row.getCell(headers.name).value || "").trim();
    const email = String(row.getCell(headers.email).value || "").trim();

    if (!name || !email) {
      skipped++;
      continue;
    }

    const contactData = {
      name,
      email,
      company: headers.company
        ? String(row.getCell(headers.company).value || "").trim() || null
        : null,
      phone_number: headers.phone_number
        ? String(row.getCell(headers.phone_number).value || "").trim() || null
        : null,
      address: headers.address
        ? String(row.getCell(headers.address).value || "").trim() || null
        : null,
    };

    // Upsert: check if contact with this email exists
    const { data: existing } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      await supabaseAdmin
        .from("contacts")
        .update(contactData)
        .eq("id", existing.id);
      updated++;
    } else {
      await supabaseAdmin.from("contacts").insert({
        ...contactData,
        created_by: session.userId,
      });
      inserted++;
    }
  }

  pushContactsToSheet().catch(console.error);

  return NextResponse.json({
    inserted,
    updated,
    skipped,
    total: inserted + updated,
  });
}
