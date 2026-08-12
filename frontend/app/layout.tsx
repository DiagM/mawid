import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mawid — Ton rendez-vous beauté, en 60 secondes",
  description:
    "Réserve ton rendez-vous chez ton coiffeur ou salon de beauté préféré en quelques secondes, sans compte, sans application.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1e3d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-beige text-navy">
        {children}
      </body>
    </html>
  );
}
