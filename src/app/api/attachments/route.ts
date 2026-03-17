import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("attachments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json(
      { error: "No files uploaded" },
      { status: 400 }
    );
  }

  const uploaded = [];

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      continue; // skip non-PDF files
    }

    const storagePath = `${session.userId}/${Date.now()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from("attachments")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error(`Failed to upload ${file.name}:`, uploadError);
      continue;
    }

    // Save metadata
    const { data, error: insertError } = await supabaseAdmin
      .from("attachments")
      .insert({
        file_name: file.name,
        storage_path: storagePath,
        content_type: "application/pdf",
        size_bytes: buffer.length,
        uploaded_by: session.userId,
      })
      .select()
      .single();

    if (!insertError && data) {
      uploaded.push(data);
    }
  }

  return NextResponse.json(uploaded, { status: 201 });
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
      { error: "Attachment ID is required" },
      { status: 400 }
    );
  }

  // Get attachment to find storage path
  const { data: attachment } = await supabaseAdmin
    .from("attachments")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (attachment) {
    await supabaseAdmin.storage
      .from("attachments")
      .remove([attachment.storage_path]);
  }

  const { error } = await supabaseAdmin
    .from("attachments")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
