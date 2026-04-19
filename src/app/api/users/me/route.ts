import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name, email, title")
    .eq("id", session.userId)
    .maybeSingle();

  if (error) {
    // `title` column may not exist yet — fall back to a minimal payload.
    const { data: fallback } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .eq("id", session.userId)
      .maybeSingle();
    return NextResponse.json({ ...(fallback || {}), title: "" });
  }

  return NextResponse.json({
    id: data?.id,
    name: data?.name,
    email: data?.email,
    title: (data as { title?: string | null } | null)?.title || "",
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const title = typeof body?.title === "string" ? body.title : "";

  const { error } = await supabaseAdmin
    .from("users")
    .update({ title })
    .eq("id", session.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, title });
}
