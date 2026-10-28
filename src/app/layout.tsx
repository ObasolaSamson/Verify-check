import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wght.css";
import "@fontsource-variable/source-serif-4/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VerifyTitle Nigeria", template: "%s | VerifyTitle Nigeria" },
  description: "Verify a Nigerian land title before you pay. Field officers, surveyors, and lawyers search the registry for you.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"),
};

export const viewport: Viewport = { themeColor: "#1e4d3a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
