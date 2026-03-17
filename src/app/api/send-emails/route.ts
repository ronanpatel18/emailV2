import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMail } from "@/lib/graph";
import {
  substituteVariables,
  plainTextToHtml,
} from "@/lib/template-utils";
import { convertDocxToStyledHtml } from "@/lib/docx-to-html";
import { pushContactsToSheet } from "@/lib/google-sheets";
import type { Contact, Template } from "@/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId || !session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { templateId, contactIds, attachmentIds } = body as {
    templateId: string;
    contactIds: string[];
    attachmentIds?: string[];
  };

  if (!templateId || !contactIds?.length) {
    return NextResponse.json(
      { error: "Template and at least one contact are required" },
      { status: 400 }
    );
  }

  // Fetch template
  const { data: template, error: templateError } = await supabaseAdmin
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (templateError || !template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 }
    );
  }

  // Fetch contacts
  const { data: contacts, error: contactsError } = await supabaseAdmin
    .from("contacts")
    .select("*")
    .in("id", contactIds);

  if (contactsError || !contacts?.length) {
    return NextResponse.json(
      { error: "No contacts found" },
      { status: 404 }
    );
  }

  // Fetch PDF attachments if any
  const emailAttachments: Array<{
    name: string;
    contentType: string;
    contentBytes: string;
  }> = [];

  if (attachmentIds && attachmentIds.length > 0) {
    const { data: attachments } = await supabaseAdmin
      .from("attachments")
      .select("*")
      .in("id", attachmentIds);

    if (attachments) {
      for (const att of attachments) {
        const { data: fileData, error: downloadError } =
          await supabaseAdmin.storage
            .from("attachments")
            .download(att.storage_path);

        if (downloadError || !fileData) {
          console.error(`Failed to download attachment ${att.file_name}:`, downloadError);
          continue;
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());
        emailAttachments.push({
          name: att.file_name,
          contentType: att.content_type || "application/pdf",
          contentBytes: buffer.toString("base64"),
        });
      }
    }
  }

  // Get HTML body from template
  let templateHtml: string;
  const typedTemplate = template as Template;

  if (typedTemplate.type === "docx" && typedTemplate.docx_storage_path) {
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("templates")
      .download(typedTemplate.docx_storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "Failed to download DOCX template" },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    templateHtml = await convertDocxToStyledHtml(buffer);
  } else {
    templateHtml = plainTextToHtml(typedTemplate.body || "");
  }

  // Send emails
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  for (const contact of contacts as Contact[]) {
    try {
      const personalizedSubject = substituteVariables(
        typedTemplate.subject,
        contact,
        false
      );
      const personalizedBody = substituteVariables(
        templateHtml,
        contact,
        true
      );

      const result = await sendMail({
        to: contact.email,
        subject: personalizedSubject,
        htmlBody: personalizedBody,
        accessToken: session.accessToken,
        attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
      });

      // Record in email_tracking
      await supabaseAdmin.from("email_tracking").insert({
        contact_id: contact.id,
        template_id: typedTemplate.id,
        sent_by: session.userId,
        subject: personalizedSubject,
        message_id: result.messageId || null,
        conversation_id: result.conversationId || null,
      });

      successCount++;
    } catch (err) {
      failCount++;
      errors.push(
        `Failed to send to ${contact.email}: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  }

  // Update Google Sheet with new tracking data
  pushContactsToSheet().catch(console.error);

  return NextResponse.json({
    success: successCount,
    failed: failCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
