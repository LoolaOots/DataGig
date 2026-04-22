import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UserMenu from "./UserMenu";

interface Props {
  /** Extra nav links shown in the center/right (before the user menu) */
  links?: { href: string; label: string }[];
  /** Set true on the dashboard page itself to hide the redundant Dashboard link */
  hideDashboard?: boolean;
}

export default async function TopNav({ links = [], hideDashboard = false }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let displayName = "";
  let dashboardHref = "/dashboard";
  let role = "user";

  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    role = (userRow as unknown as { role: string } | null)?.role ?? "user";
    dashboardHref = role === "company" ? "/company/dashboard" : "/dashboard";

    if (role === "company") {
      const { data: cp } = await supabase
        .from("company_profiles")
        .select("company_name")
        .eq("user_id", user.id)
        .single();
      displayName = (cp as unknown as { company_name: string } | null)?.company_name ?? user.email ?? "";
    } else {
      const { data: up } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();
      displayName = (up as unknown as { display_name: string | null } | null)?.display_name ?? user.email ?? "";
    }
  }

  return (
    <nav className="border-b bg-white px-6 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-gray-900">
          DataGigs
        </Link>

        <div className="flex items-center gap-4 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-gray-600 hover:text-gray-900">
              {l.label}
            </Link>
          ))}

          {user ? (
            <>
              {!hideDashboard && (
                <Link href={dashboardHref} className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
              )}
              {role === "company" && (
                <Link
                  href="/company/support"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Need help?
                </Link>
              )}
              <UserMenu
                displayName={displayName}
                email={user.email ?? ""}
                dashboardHref={dashboardHref}
                role={role}
              />
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-600 hover:text-gray-900">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
              >
                Post a gig
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
