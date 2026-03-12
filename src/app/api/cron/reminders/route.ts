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

  // Get access token via refresh token
  const refreshToken = process.env.MS_GRAPH_REFRESH_TOKEN;
  if (!refreshToken) {
    return NextResponse.json(
      { error: "No refresh token configured" },
      { status: 500 }
    );
  }

  let accessToken: string;
  try {
    const tokens = await refreshAccessToken(refreshToken);
    accessToken = tokens.access_token;
  } catch (err) {
    return NextResponse.json(
      {
        error: `Token refresh failed: ${
          err instanceof Error ? err.message : "Unknown"
        }`,
      },
      { status: 500 }
    );
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

  let remindersSent = 0;
  let repliesFound = 0;

  for (const email of pendingEmails) {
    if (!email.conversation_id) continue;

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
  });
}
