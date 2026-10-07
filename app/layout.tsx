import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppProviders } from "@/components/providers/app-providers";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ProfitTrack — Reseller Profit Book",
    template: "%s · ProfitTrack",
  },
  description:
    "Cloud profit tracker for WhatsApp resellers: cost price, profit, supplier groups and WhatsApp-ready share text.",
  applicationName: "ProfitTrack",
  appleWebApp: {
    capable: true,
    title: "ProfitTrack",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} overscroll-y-none font-sans antialiased`}
      >
        <ClerkProvider>
          <ThemeProvider>
            <MotionConfig reducedMotion="user">
              <AppProviders>{children}</AppProviders>
            </MotionConfig>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
