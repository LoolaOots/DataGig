import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, credits_balance_cents, stripe_onboarding_complete")
    .eq("user_id", user.id)
    .single();

  const { data: applications } = await supabase
    .from("applications")
    .select("id, status, gigs(id, title)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const creditsDisplay = profile
    ? `$${(profile.credits_balance_cents / 100).toFixed(2)}`
    : "$0.00";

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav hideDashboard links={[
        { href: "/dashboard/applications", label: "Applications" },
        { href: "/dashboard/submissions", label: "Submissions" },
        { href: "/dashboard/earnings", label: "Earnings" },
        { href: "/gigs", label: "Browse Gigs" },
      ]} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">
          Welcome back, {profile?.display_name ?? "there"}
        </h1>
        <p className="mb-8 text-gray-500">Here&apos;s your activity overview.</p>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-6">
            <p className="text-sm text-gray-500">Credits Earned</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">{creditsDisplay}</p>
          </div>
          <div className="rounded-xl border bg-white p-6">
            <p className="text-sm text-gray-500">Active Applications</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">
              {applications?.filter((a) => a.status === "accepted").length ?? 0}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-6">
            <p className="text-sm text-gray-500">Payout Setup</p>
            <p className="mt-1 text-sm font-medium">
              {profile?.stripe_onboarding_complete ? (
                <span className="text-green-600">Connected</span>
              ) : (
                <Link href="/dashboard/payouts/setup" className="text-blue-600 hover:underline">
                  Set up payouts
                </Link>
              )}
            </p>
          </div>
        </div>

        {/* Recent applications */}
        <div className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="font-semibold text-gray-900">Recent Applications</h2>
            <Link href="/dashboard/applications" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {applications && applications.length > 0 ? (
            <ul className="divide-y">
              {applications.map((app) => (
                <li key={app.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    {(() => {
                      const gig = app.gigs as unknown as { id: string; title: string } | null;
                      return gig ? (
                        <Link href={`/gigs/${gig.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                          {gig.title}
                        </Link>
                      ) : (
                        <p className="font-medium text-gray-900">Gig</p>
                      );
                    })()}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      app.status === "accepted"
                        ? "bg-green-100 text-green-700"
                        : app.status === "denied"
                        ? "bg-red-100 text-red-700"
                        : app.status === "withdrawn"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {app.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center text-gray-500">
              <p>No applications yet.</p>
              <Link href="/gigs" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                Browse available gigs
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
