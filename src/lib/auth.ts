import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { supabaseAdmin } from "./supabase";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    userId?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    userId?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
      authorization: {
        params: {
          scope:
            "openid profile email User.Read Mail.Send Mail.ReadWrite offline_access",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // On initial sign-in, persist tokens
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;

        // Validate @wisc.edu domain
        const email =
          profile?.email ||
          (profile as Record<string, unknown>)?.preferred_username;
        if (typeof email === "string" && !email.endsWith("@wisc.edu")) {
          throw new Error("Only @wisc.edu accounts are allowed.");
        }

        // Upsert user in Supabase and auto-add to group
        if (typeof email === "string") {
          const { data: existingUser } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", email)
            .single();

          let userId: string | undefined;

          if (existingUser) {
            userId = existingUser.id;
          } else {
            const { data: newUser } = await supabaseAdmin
              .from("users")
              .insert({
                email,
                name:
                  (profile?.name as string) || email.split("@")[0],
              })
              .select("id")
              .single();
            if (newUser) {
              userId = newUser.id;
            }
          }

          if (userId) {
            token.userId = userId;

            // Auto-add to the first access group if not already a member
            const { data: membership } = await supabaseAdmin
              .from("group_members")
              .select("user_id")
              .eq("user_id", userId)
              .limit(1)
              .maybeSingle();

            if (!membership) {
              const { data: group } = await supabaseAdmin
                .from("access_groups")
                .select("id")
                .limit(1)
                .single();

              if (group) {
                await supabaseAdmin.from("group_members").insert({
                  group_id: group.id,
                  user_id: userId,
                  role: "member",
                });
              }
            }
          }
        }
      }

      // Refresh access token if expired
      if (
        token.accessTokenExpires &&
        Date.now() > token.accessTokenExpires &&
        token.refreshToken
      ) {
        try {
          const tenantId =
            process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.split("/")[3] ||
            "common";
          const response = await fetch(
            `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
                client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
                scope:
                  "openid profile email User.Read Mail.Send Mail.ReadWrite offline_access",
              }),
            }
          );
          const tokens = await response.json();
          if (tokens.access_token) {
            token.accessToken = tokens.access_token;
            token.refreshToken = tokens.refresh_token ?? token.refreshToken;
            token.accessTokenExpires = Date.now() + tokens.expires_in * 1000;
          }
        } catch (error) {
          console.error("Error refreshing access token:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).accessToken = token.accessToken;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).userId = token.userId;
      return session;
    },
  },
});
