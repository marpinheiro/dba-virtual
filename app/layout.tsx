import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// 1. Importar o Analytics
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CQLE DBA Virtual",
  description: "Seu assistente de Banco de Dados com IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {children}
        {/* 2. Adicionar o componente aqui */}
        <Analytics />
      </body>
    </html>
  );
}