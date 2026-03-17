import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { pushContactsToSheet } from "@/lib/google-sheets";

export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get contacts
  const { data: contacts, error } = await supabaseAdmin
    .from("contacts")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  // Get last email tracking for each contact (with sender)
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

  const contactsWithTracking = contacts.map((c) => ({
    ...c,
    last_sent_at: lastSentMap.get(c.id)?.sent_at || null,
    last_subject: lastSentMap.get(c.id)?.subject || null,
    last_sent_by_name: lastSentMap.get(c.id)?.sent_by_name || null,
    assigned_to_name: c.assigned_to
      ? userIdToName.get(c.assigned_to) || null
      : null,
  }));

  return NextResponse.json(contactsWithTracking);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, email, company, assigned_to } = body;

  if (!name || !email) {
    return NextResponse.json(
      { error: "Name and email are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      name,
      email,
      company: company || null,
      assigned_to: assigned_to || null,
      created_by: session.userId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  pushContactsToSheet().catch(console.error);

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, name, email, company, assigned_to } = body;

  if (!id) {
    return NextResponse.json(
      { error: "Contact ID is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .update({
      name,
      email,
      company: company || null,
      assigned_to: assigned_to || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  pushContactsToSheet().catch(console.error);

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Contact ID is required" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("contacts")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  pushContactsToSheet().catch(console.error);

  return NextResponse.json({ success: true });
}
