import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { getServerSession } from "@/lib/session";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Painel Financeiro DRE",
  description: "Dashboard financeiro com importação CSV, chat SQL e gestão de usuários",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = getServerSession();

  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppShell session={session}>{children}</AppShell>
      </body>
    </html>
  );
}
