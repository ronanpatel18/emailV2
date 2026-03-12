import { Client } from "@microsoft/microsoft-graph-client";

export function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

interface SendMailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  accessToken: string;
}

interface GraphSendResponse {
  messageId?: string;
  conversationId?: string;
}

export async function sendMail({
  to,
  subject,
  htmlBody,
  accessToken,
}: SendMailOptions): Promise<GraphSendResponse> {
  const client = getGraphClient(accessToken);

  // Save as draft first to get message ID
  const draft = await client.api("/me/messages").post({
    subject,
    body: {
      contentType: "HTML",
      content: htmlBody,
    },
    toRecipients: [
      {
        emailAddress: { address: to },
      },
    ],
  });

  // Send the draft
  await client.api(`/me/messages/${draft.id}/send`).post({});

  return {
    messageId: draft.internetMessageId || draft.id,
    conversationId: draft.conversationId,
  };
}

export async function checkForReplies(
  accessToken: string,
  conversationId: string
): Promise<boolean> {
  const client = getGraphClient(accessToken);

  try {
    const messages = await client
      .api("/me/messages")
      .filter(`conversationId eq '${conversationId}'`)
      .select("id,from,receivedDateTime")
      .orderby("receivedDateTime desc")
      .top(10)
      .get();

    // If there are more than 1 message in the conversation, there's a reply
    return messages.value && messages.value.length > 1;
  } catch {
    return false;
  }
}

interface TokenRefreshResult {
  access_token: string;
  refresh_token?: string;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenRefreshResult> {
  const tokenEndpoint = `https://login.microsoftonline.com/${
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.split("/")[3] || "common"
  }/oauth2/v2.0/token`;

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "https://graph.microsoft.com/.default offline_access",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json();
}
