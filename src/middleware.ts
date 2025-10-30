import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/server/auth";

const PUBLIC_PATHS = [
  "/signin",
  "/api/auth",
  "/api/v1/identity/auth",
  "/api/health",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => {
    if (path.endsWith("/")) {
      return pathname.startsWith(path);
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next/") || pathname.startsWith("/static/")) {
    return NextResponse.next();
  }

  if (req.auth?.user?.id) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "unauthorized", message: "请先登录后再访问接口" },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/signin", req.url);
  loginUrl.searchParams.set(
    "callbackUrl",
    req.nextUrl.pathname + req.nextUrl.search,
  );
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
