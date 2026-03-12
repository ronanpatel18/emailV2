import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Email Manager - WSBC",
  description: "A secure and elegant way to manage contacts and email templates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans text-[var(--color-warm-900)] bg-[var(--color-warm-50)] antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
