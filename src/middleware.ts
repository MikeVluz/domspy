import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter for auth endpoints
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

// Clean old entries every 5 minutes
if (typeof globalThis !== "undefined") {
  const cleanInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of loginAttempts) {
      if (val.resetAt < now) loginAttempts.delete(key);
    }
  }, 5 * 60 * 1000);
  // Don't block process exit
  if (cleanInterval.unref) cleanInterval.unref();
}

function getRateLimitKey(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return ip;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate limit login attempts: 10 per IP per 15 minutes
  if (pathname === "/api/auth/callback/credentials" && req.method === "POST") {
    const key = `login:${getRateLimitKey(req)}`;
    const now = Date.now();
    const window = 15 * 60 * 1000;
    const maxAttempts = 10;

    const entry = loginAttempts.get(key);

    if (!entry || entry.resetAt < now) {
      loginAttempts.set(key, { count: 1, resetAt: now + window });
    } else {
      entry.count++;
      if (entry.count > maxAttempts) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return NextResponse.json(
          { error: `Muitas tentativas de login. Tente novamente em ${retryAfter}s` },
          { status: 429, headers: { "Retry-After": String(retryAfter) } }
        );
      }
    }
  }

  // Rate limit crawl endpoints: 3 per IP per minute
  if ((pathname === "/api/crawl" || pathname === "/api/crawl-all") && req.method === "POST") {
    const key = `crawl:${getRateLimitKey(req)}`;
    const now = Date.now();
    const entry = loginAttempts.get(key);

    if (!entry || entry.resetAt < now) {
      loginAttempts.set(key, { count: 1, resetAt: now + 60000 });
    } else {
      entry.count++;
      if (entry.count > 3) {
        return NextResponse.json(
          { error: "Limite de crawl atingido. Aguarde 1 minuto." },
          { status: 429 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
