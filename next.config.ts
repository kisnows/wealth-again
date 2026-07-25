import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 强制 Turbopack 将当前目录视为工作空间根，避免跨项目锁文件干扰
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
