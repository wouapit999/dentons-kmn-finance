// Edge middleware: gate protected routes on a valid (well-formed, unexpired)
// session token. Deep session-revocation checks happen in the Node layer.
import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/jwt";

const PUBLIC_PATHS = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? await verifyToken(token) : null;

  // Signed-in users hitting /login → send to dashboard.
  if (isPublic && claims) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Unauthenticated users hitting a protected page → send to login.
  if (!isPublic && !claims) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except Next internals, the login API, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
