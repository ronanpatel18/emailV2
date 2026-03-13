import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMail, checkForReplies } from "@/lib/graph";

export async function POST() {
  const session = await auth();
  if (!session?.userId || !session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return processReminders(session.accessToken);
}

async function processReminders(accessToken: string) {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Find emails sent > 7 days ago with no reply and no reminder
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

    const hasReply = await checkForReplies(accessToken, email.conversation_id);

    if (hasReply) {
      await supabaseAdmin
        .from("email_tracking")
        .update({ replied_at: new Date().toISOString() })
        .eq("id", email.id);
      repliesFound++;
    } else {
      // Send reminder to configured email
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
  }

  return NextResponse.json({
    processed: pendingEmails.length,
    remindersSent,
    repliesFound,
  });
}
