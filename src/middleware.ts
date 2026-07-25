import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/signin",
  "/signup",
  "/api/auth",
  "/api/v1/identity/auth",
  "/api/v1/identity/register",
  "/api/v1/identity/cities",
  "/api/internal/auth/session",
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

async function resolveSession(req: NextRequest) {
  try {
    const cookie = req.headers.get("cookie");
    if (!cookie) return null;
    const sessionUrl = new URL("/api/internal/auth/session", req.url);
    const response = await fetch(sessionUrl, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      session?: { user?: { id?: string } | null } | null;
    };
    return data.session ?? null;
  } catch (error) {
    console.error("Failed to resolve auth session", error);
    return null;
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next/") || pathname.startsWith("/static/")) {
    return NextResponse.next();
  }

  const session = await resolveSession(req);
  if (session?.user?.id) {
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
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
