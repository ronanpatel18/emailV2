import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { pushContactsToSheet } from "@/lib/google-sheets";

export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get contacts with last email info
  const { data: contacts, error } = await supabaseAdmin
    .from("contacts")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get last email tracking for each contact
  const contactIds = contacts.map((c) => c.id);
  const { data: tracking } = await supabaseAdmin
    .from("email_tracking")
    .select("contact_id, sent_at, subject")
    .in("contact_id", contactIds.length > 0 ? contactIds : ["none"])
    .order("sent_at", { ascending: false });

  // Map last sent info to contacts
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

  const contactsWithTracking = contacts.map((c) => ({
    ...c,
    last_sent_at: lastSentMap.get(c.id)?.sent_at || null,
    last_subject: lastSentMap.get(c.id)?.subject || null,
  }));

  return NextResponse.json(contactsWithTracking);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, email, company, phone_number, address } = body;

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
      phone_number: phone_number || null,
      address: address || null,
      created_by: session.userId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Regenerate shared Excel in background (don't block response)
  pushContactsToSheet().catch(console.error);

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, name, email, company, phone_number, address } = body;

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
      phone_number: phone_number || null,
      address: address || null,
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
