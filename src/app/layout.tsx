import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "sanell.online",
  description: "Personal site and tools by Sanell",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-black`}
      >
        <header className="p-6 text-sm text-gray-500">
          <nav className="flex gap-6">
            <a href="/">home</a>
            <a href="/works">works</a>
            <a href="/assets">assets</a>
            <a href="/tools">tools</a>
            <a href="/playground">playground</a>
            <a href="/about">about</a>
          </nav>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}

