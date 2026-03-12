import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Email Manager",
  description: "WSBC Email Manager",
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
      <body className="font-sans bg-white text-[#171717] antialiased">
        {children}
      </body>
    </html>
  );
}
