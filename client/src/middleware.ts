import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * "/" is two different pages depending on who is asking:
 *   - signed in  -> the dashboard (app/(app)/page.tsx)
 *   - everyone else -> the public landing page (app/(marketing)/home/page.tsx)
 *
 * It is a rewrite, not a redirect, so the address bar stays on trunqo.org and shared links
 * stay clean. /home is also reachable directly and is canonicalised to "/".
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/home";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/"],
};
