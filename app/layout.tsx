import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthBootstrap from "@/components/auth-bootstrap";
import ThemeController from "@/components/theme-controller";
import UIController from "@/components/ui-controller";
import { QueryProvider } from "@/components/providers/query-provider";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "MyBizAI", template: "%s | MyBizAI" },
  description:
    "AI-powered business operating system for SMBs — manage leads, customers, agents, and more.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
};

// Inline script that runs synchronously before React hydrates to prevent theme flash.
// Reads the user's saved preference from localStorage and applies the dark class immediately.
const themeScript = `
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme:dark)').matches))
      document.documentElement.classList.add('dark');
  } catch(e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
  const apiOrigin = new URL(apiUrl).origin;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href={apiOrigin} />
        <link rel="preconnect" href={apiOrigin} crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-bg-primary text-text-primary`}
      >
        <ThemeController />
        <UIController />
        <WebVitalsReporter />
        <QueryProvider>
          <AuthBootstrap>{children}</AuthBootstrap>
        </QueryProvider>
      </body>
    </html>
  );
}
