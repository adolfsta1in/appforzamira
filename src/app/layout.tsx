import type { Metadata } from "next";
import { PT_Serif } from "next/font/google";
import "./globals.css";
import Navigation from "./components/Navigation";

const ptSerif = PT_Serif({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['cyrillic', 'latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Реестр сертификатов — Тоҷикстандарт",
  description: "Парсер сертификатов соответствия для реестра",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={ptSerif.className}>
        <Navigation />
        {children}
      </body>
    </html>
  );
}
