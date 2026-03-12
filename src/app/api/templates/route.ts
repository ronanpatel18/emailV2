import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("templates")
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
  const name = formData.get("name") as string;
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string | null;
  const type = (formData.get("type") as string) || "plain";
  const file = formData.get("file") as File | null;

  if (!name || !subject) {
    return NextResponse.json(
      { error: "Name and subject are required" },
      { status: 400 }
    );
  }

  let docxStoragePath: string | null = null;

  if (type === "docx" && file) {
    const fileName = `${Date.now()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from("templates")
      .upload(fileName, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    docxStoragePath = fileName;
  }

  const { data, error } = await supabaseAdmin
    .from("templates")
    .insert({
      name,
      subject,
      body: type === "plain" ? body : null,
      type,
      docx_storage_path: docxStoragePath,
      created_by: session.userId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string | null;
  const type = (formData.get("type") as string) || "plain";
  const file = formData.get("file") as File | null;

  if (!id) {
    return NextResponse.json(
      { error: "Template ID is required" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = { name, subject, type };

  if (type === "plain") {
    updateData.body = body;
    updateData.docx_storage_path = null;
  }

  if (type === "docx" && file) {
    // Delete old file if exists
    const { data: existing } = await supabaseAdmin
      .from("templates")
      .select("docx_storage_path")
      .eq("id", id)
      .single();

    if (existing?.docx_storage_path) {
      await supabaseAdmin.storage
        .from("templates")
        .remove([existing.docx_storage_path]);
    }

    const fileName = `${Date.now()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from("templates")
      .upload(fileName, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    updateData.docx_storage_path = fileName;
    updateData.body = null;
  }

  const { data, error } = await supabaseAdmin
    .from("templates")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
      { error: "Template ID is required" },
      { status: 400 }
    );
  }

  // Delete file from storage if it exists
  const { data: template } = await supabaseAdmin
    .from("templates")
    .select("docx_storage_path")
    .eq("id", id)
    .single();

  if (template?.docx_storage_path) {
    await supabaseAdmin.storage
      .from("templates")
      .remove([template.docx_storage_path]);
  }

  const { error } = await supabaseAdmin
    .from("templates")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
