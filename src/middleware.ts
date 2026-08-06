/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Edge middleware. Three jobs, in order:
//   1. HTTP-method hardening  - reject TRACE/DEBUG/CONNECT/MOVE/TRACK etc.
//                               everywhere; allow only read verbs on page routes.
//   2. Probe-path blocking    - fast 404 for common vuln-scanner paths
//                               (adminer, wp-config.php, .env, .git, actuator ...).
//   3. Auth gating            - redirect page routes to /login when unauthenticated.
// Security response headers are set centrally in next.config.mjs and apply to
// every route (pages, API, static).
import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/jwt";

const PUBLIC_PATHS = ["/login"];

// Methods the application ever legitimately uses.
const GLOBAL_METHODS = new Set(["GET", "HEAD", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"]);
// Page (non-API) routes only ever read or post a form/login; write verbs there
// are never valid and are rejected.
const PAGE_METHODS = new Set(["GET", "HEAD", "POST", "OPTIONS"]);

// Common paths that only a scanner or attacker would request. These never exist
// in this app; short-circuit them to a clean 404 so probes get no signal.
const PROBE = new RegExp(
  [
    // Server-side script / secret / backup file extensions this app never serves.
    "\\.(php|php5|phtml|asp|aspx|jsp|cgi|env|bak|old|sql|ini|sh|swp|git|htaccess|htpasswd)(/|$)",
    // Known admin/db/framework probe roots and dotfiles.
    "(^|/)(wp-|xmlrpc|adminer|phpmyadmin|pma|mysql|actuator|solr|jenkins|\\.env|\\.git|\\.aws|\\.ssh)",
    // Bare probe path.
    "(^|/)debug(/|$)",
  ].join("|"),
  "i",
);

// Legitimate static-asset extensions - pass through without an auth redirect.
const ASSET = /\.(png|jpe?g|gif|svg|ico|webp|avif|txt|xml|json|webmanifest|woff2?|ttf|otf|css|js|map)$/i;

function methodNotAllowed() {
  return new NextResponse("Method Not Allowed", {
    status: 405,
    headers: { Allow: "GET, HEAD, POST, OPTIONS", "Content-Type": "text/plain" },
  });
}
function notFound() {
  return new NextResponse("Not Found", { status: 404, headers: { "Content-Type": "text/plain" } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();
  const isApi = pathname.startsWith("/api");

  // 1. Method hardening.
  if (!GLOBAL_METHODS.has(method)) return methodNotAllowed();
  if (!isApi && !PAGE_METHODS.has(method)) return methodNotAllowed();

  // 2. Probe-path blocking.
  if (PROBE.test(pathname)) return notFound();

  // 3. Auth gating - page routes only (API routes enforce auth in their handlers).
  if (!isApi) {
    if (ASSET.test(pathname)) return NextResponse.next(); // static public files
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const claims = token ? await verifyToken(token) : null;

    if (isPublic && claims) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (!isPublic && !claims) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and the favicon so method-hardening
  // and probe-blocking cover API routes and dot-paths too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
