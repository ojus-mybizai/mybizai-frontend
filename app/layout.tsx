import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthBootstrap from "@/components/auth-bootstrap";
import ThemeController from "@/components/theme-controller";

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
  title: "MyBizAI",
  description: "MyBizAI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
  const apiOrigin = new URL(apiUrl).origin;
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href={apiOrigin} />
        <link rel="preconnect" href={apiOrigin} crossOrigin="anonymous" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-bg-primary text-text-primary`}>
        <ThemeController />
        <AuthBootstrap>{children}</AuthBootstrap>
      </body>
    </html>
  );
}
