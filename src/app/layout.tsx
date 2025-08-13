import React from "react";
import "./globals.css";
import Providers from "@/components/providers";

export const metadata = {
  title: "财富管理系统",
  description: "个人财富管理MVP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
