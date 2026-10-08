import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bari Agent City",
  description: "Esplora Bari in 3D e guida la tua squadra di agenti tra aziende reali, analisi e progetti.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
