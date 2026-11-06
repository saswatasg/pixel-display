import type { Metadata, Viewport } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pixel Display Controller",
  description: "Web control for the APEX/iDotMatrix 32x32 pixel display",
  applicationName: "Pixel Display",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "Pixel Display Controller",
    description: "Control your nearby 32×32 LED display using this device’s Bluetooth.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f8f8f5" }, { media: "(prefers-color-scheme: dark)", color: "#181b19" }],
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}