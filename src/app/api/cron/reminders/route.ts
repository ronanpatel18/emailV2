import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMail, checkForReplies, refreshAccessToken } from "@/lib/graph";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: pendingEmails, error } = await supabaseAdmin
    .from("email_tracking")
    .select("*, contacts(name, email)")
    .lt("sent_at", sevenDaysAgo)
    .is("replied_at", null)
    .is("reminder_sent_at", null)
    .not("conversation_id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pendingEmails?.length) {
    return NextResponse.json({ message: "No reminders needed", processed: 0 });
  }

  // Collect unique sender IDs so we can fetch their refresh tokens
  const senderIds = [...new Set(pendingEmails.map((e) => e.sent_by).filter(Boolean))];
  const { data: senders } = await supabaseAdmin
    .from("users")
    .select("id, refresh_token")
    .in("id", senderIds.length > 0 ? senderIds : ["none"]);

  // Build a map of sender ID → refresh token
  const senderTokenMap = new Map<string, string>();
  if (senders) {
    for (const s of senders) {
      if (s.refresh_token) {
        senderTokenMap.set(s.id, s.refresh_token);
      }
    }
  }

  // Cache refreshed access tokens to avoid refreshing the same token multiple times
  const accessTokenCache = new Map<string, string>();

  let remindersSent = 0;
  let repliesFound = 0;
  let skipped = 0;

  for (const email of pendingEmails) {
    if (!email.conversation_id || !email.sent_by) continue;

    // Get the original sender's refresh token
    const refreshToken = senderTokenMap.get(email.sent_by);
    if (!refreshToken) {
      skipped++;
      continue;
    }

    // Get or refresh access token for this sender
    let accessToken = accessTokenCache.get(email.sent_by);
    if (!accessToken) {
      try {
        const tokens = await refreshAccessToken(refreshToken);
        accessToken = tokens.access_token;
        accessTokenCache.set(email.sent_by, accessToken);

        // Update stored refresh token if it was rotated
        if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
          await supabaseAdmin
            .from("users")
            .update({ refresh_token: tokens.refresh_token })
            .eq("id", email.sent_by);
        }
      } catch (err) {
        console.error(`Failed to refresh token for user ${email.sent_by}:`, err);
        skipped++;
        continue;
      }
    }

    try {
      const hasReply = await checkForReplies(
        accessToken,
        email.conversation_id
      );

      if (hasReply) {
        await supabaseAdmin
          .from("email_tracking")
          .update({ replied_at: new Date().toISOString() })
          .eq("id", email.id);
        repliesFound++;
      } else {
        const reminderTo = process.env.REMINDER_TO_EMAIL;
        if (reminderTo) {
          const contact = email.contacts as { name: string; email: string } | null;
          await sendMail({
            to: reminderTo,
            subject: `Reminder: No reply from ${contact?.name || "Unknown"} (${contact?.email || "Unknown"})`,
            htmlBody: `
              <p>No reply received for the following email:</p>
              <ul>
                <li><strong>Contact:</strong> ${contact?.name || "Unknown"} (${contact?.email || "Unknown"})</li>
                <li><strong>Subject:</strong> ${email.subject || "N/A"}</li>
                <li><strong>Sent:</strong> ${new Date(email.sent_at).toLocaleDateString()}</li>
              </ul>
              <p>Consider following up manually.</p>
            `,
            accessToken,
          });

          await supabaseAdmin
            .from("email_tracking")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", email.id);
          remindersSent++;
        }
      }
    } catch (err) {
      console.error(`Error processing email ${email.id}:`, err);
    }
  }

  return NextResponse.json({
    processed: pendingEmails.length,
    remindersSent,
    repliesFound,
    skipped,
  });
}
