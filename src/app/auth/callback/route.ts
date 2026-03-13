import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // Ensure user record exists in public.users — the trigger may have failed or not fired yet.
  // We use the service-role client here to bypass RLS.
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .single();

  let role = existing?.role ?? "user";

  if (!existing) {
    // Determine role from Supabase metadata set during signup
    const metaRole = user.user_metadata?.role;
    role = metaRole === "company" ? "company" : "user";

    await admin.from("users").insert({
      id: user.id,
      email: user.email!,
      role,
    });

    if (role === "company") {
      const companyName =
        user.user_metadata?.company_name ?? "My Company";
      await admin.from("company_profiles").insert({
        user_id: user.id,
        company_name: companyName,
      });
    } else {
      const displayName =
        user.user_metadata?.display_name ??
        user.email?.split("@")[0] ??
        "User";
      await admin.from("user_profiles").insert({
        user_id: user.id,
        display_name: displayName,
      });
    }
  }

  // Redirect based on role
  const redirectTo =
    role === "company" ? `${origin}/company/dashboard` : `${origin}/dashboard`;

  return NextResponse.redirect(redirectTo);
}
