import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // 对于需要认证的路由，如果用户未登录则重定向到登录页
    if (!req.nextauth.token) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // 公开路由，无需认证
        const publicPaths = [
          "/auth/login",
          "/auth/register",
          "/api/auth",
          "/api/health",
          "/_next",
          "/favicon.ico"
        ];

        const { pathname } = req.nextUrl;
        
        // 检查是否是公开路径
        if (publicPaths.some(path => pathname.startsWith(path))) {
          return true;
        }

        // API路由需要token
        if (pathname.startsWith("/api/")) {
          return !!token;
        }

        // 页面路由需要token
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};