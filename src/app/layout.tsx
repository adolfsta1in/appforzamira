import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
