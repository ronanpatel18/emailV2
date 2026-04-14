import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  pushContactsToSheet,
  pullContactsFromSheet,
  getSheetUrl,
} from "@/lib/google-sheets";

/**
 * GET — Return the Google Sheet URL. No network calls required.
 */
export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ url: getSheetUrl() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sheet not configured" },
      { status: 500 }
    );
  }
}

/**
 * POST — Full bidirectional sync.
 * 1. Pull changes from Sheet → Supabase
 * 2. Push updated Supabase data → Sheet (so tracking columns update too)
 */
export async function POST() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Pull first so sheet edits get captured
    const result = await pullContactsFromSheet(session.userId);

    // Then push to update tracking columns and normalize data
    await pushContactsToSheet();

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
