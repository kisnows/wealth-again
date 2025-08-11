import React from "react";
import "./globals.css";
import Navbar from "@/components/layout/navbar";

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
        <Navbar />
        <main className="container mx-auto py-8">{children}</main>
      </body>
    </html>
  );
}
