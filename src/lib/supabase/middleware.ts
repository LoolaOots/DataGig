import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not add code between createServerClient and auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't require auth
  const publicRoutes = ["/", "/gigs", "/login", "/signup", "/auth/callback"];
  const isPublicRoute =
    publicRoutes.some((r) => pathname === r) ||
    pathname.startsWith("/gigs/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/inngest");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Get role from DB
    const { data: userRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = userRow?.role ?? "user";

    // Block user-role accounts — website is company-only
    if (role === "user") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Redirect wrong-role users
    if (pathname.startsWith("/dashboard") && role !== "user" && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/company/dashboard";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/company") && role !== "company" && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/admin") && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from auth pages
    if (pathname === "/login" || pathname === "/signup") {
      const url = request.nextUrl.clone();
      url.pathname = role === "company" ? "/company/dashboard" : "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
