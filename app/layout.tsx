import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Underpaint — Oil Painting Studio Companion",
  description:
    "Turn any reference photo into 5 simple oil painting steps and click any color to see how to mix it with real paint tubes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] selection:bg-[var(--accent-muted)] selection:text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  );
}
