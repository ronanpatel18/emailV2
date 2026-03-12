import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  pullContactsFromSheet,
  pushContactsToSheet,
} from "@/lib/google-sheets";

/**
 * Vercel cron — periodic bidirectional sync between Google Sheet and Supabase.
 * Runs every 5 minutes (configurable in vercel.json).
 *
 * 1. Pulls sheet edits → Supabase
 * 2. Pushes Supabase state → Sheet (updates tracking columns)
 *
 * Uses a service account user ID for attribution on inserts.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get any admin user to attribute inserts to
    const { data: adminMember } = await supabaseAdmin
      .from("group_members")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    const userId = adminMember?.user_id;
    if (!userId) {
      return NextResponse.json(
        { error: "No admin user found for attribution" },
        { status: 500 }
      );
    }

    // Pull sheet → Supabase
    const result = await pullContactsFromSheet(userId);

    // Push Supabase → sheet
    await pushContactsToSheet();

    return NextResponse.json({
      ...result,
      synced: true,
    });
  } catch (err) {
    console.error("Sheet sync cron error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
