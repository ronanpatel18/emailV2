import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Dev-only endpoint to capture refresh token for cron jobs.
// After signing in, visit /api/dev/refresh-token to get the token.
// Store it as MS_GRAPH_REFRESH_TOKEN in your environment.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    message:
      "Copy the access token below and use the OAuth flow to get a refresh token. " +
      "The refresh token is stored in the JWT and not directly accessible here. " +
      "Check your NextAuth JWT callback logs or use the Azure portal to generate one.",
    note: "Sign in with the app, then check server logs for the refresh token in the jwt callback.",
  });
}
