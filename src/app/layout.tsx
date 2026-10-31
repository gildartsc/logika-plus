import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { APP_NAME } from "@/config/app";
import "./globals.css";

// Self-hosted by Next.js at build time; no requests to Google from the browser.
// Without a weight list Rubik loads as one variable font covering every
// weight, so text in streamed parts never waits for another font file.
const rubik = Rubik({
  subsets: ["latin", "cyrillic"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Платформа развития критического и инженерного мышления для 9 класса",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbf8f1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${rubik.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
