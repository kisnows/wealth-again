import React from "react";
import "./globals.css";

export const metadata = {
  title: "Wealth Manager",
  description: "Personal wealth management MVP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen font-sans antialiased">
        <header className="p-4 border-b flex gap-4">
          <a href="/">首页</a>
          <a href="/income">收入</a>
          <a href="/config">参数</a>
        </header>
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}
