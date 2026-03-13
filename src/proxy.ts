import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Simple in-memory rate limiter (resets on cold start — fine for edge/serverless)
// For production use, replace with Redis-backed rate limiting (e.g. Upstash)
const rateStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= limit) return false; // blocked

  entry.count++;
  return true;
}

// Routes with rate limits: [path-prefix, requests, window-ms]
const RATE_LIMITS: [string, number, number][] = [
  ["/api/applications", 20, 60_000],       // 20 applies/min
  ["/api/submissions", 30, 60_000],         // 30 submissions/min
  ["/api/payouts/request", 5, 60_000],      // 5 payout requests/min
  ["/api/stripe/checkout", 10, 60_000],     // 10 checkout sessions/min
  ["/api/stripe/connect", 10, 60_000],      // 10 onboarding/min
  ["/auth/callback", 30, 60_000],           // 30 auth callbacks/min
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply rate limiting to mutation API routes
  if (request.method === "POST" || request.method === "PATCH") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";

    for (const [prefix, limit, window] of RATE_LIMITS) {
      if (pathname.startsWith(prefix)) {
        const key = `${ip}:${prefix}`;
        if (!rateLimit(key, limit, window)) {
          return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            { status: 429 }
          );
        }
        break;
      }
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
