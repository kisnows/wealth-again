/** @type {import('next').NextConfig} */
const nextConfig = {
  // 性能优化
  swcMinify: true,
  poweredByHeader: false,

  // 安全配置
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  // 实验性功能
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-slot"],
  },

  // 编译配置
  typescript: {
    // 在生产构建时仍然进行类型检查
    ignoreBuildErrors: false,
  },

  // 环境变量
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

export default nextConfig;
