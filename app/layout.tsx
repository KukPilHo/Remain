import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "기록하다 — 음성을 텍스트로",
  description: "마이크로 녹음하면 AI가 텍스트로 변환해 드립니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
