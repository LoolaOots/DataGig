import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import TopNav from "@/components/TopNav";

export default async function CompanyDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("company_profiles")
    .select("company_name, balance_cents")
    .eq("user_id", user.id)
    .single();

  const { data: gigs } = await supabase
    .from("gigs")
    .select("id, title, status, filled_slots, total_slots, created_at")
    .eq("company_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const balanceDollars = profile
    ? (profile.balance_cents / 100).toFixed(2)
    : "0.00";

  const totalGigs = gigs?.length ?? 0;

  const totalRecordings = await prisma.submission.count({
    where: {
      status: "accepted",
      storagePath: { not: null },
      application: {
        gig: { companyId: user.id },
      },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav hideDashboard links={[
        { href: "/company/gigs", label: "Gigs" },
        { href: "/company/data", label: "Data" },
        { href: "/company/gigs/new", label: "New Gig" },
      ]} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">
          {profile?.company_name ?? "Company"} Dashboard
        </h1>
        <p className="mb-8 text-gray-500">Manage your data collection campaigns.</p>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link href="/company/billing" className="rounded-xl border bg-white p-6 hover:border-blue-300 hover:shadow-sm transition">
            <p className="text-sm text-gray-500">Account Balance</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">${balanceDollars}</p>
            <p className="mt-2 text-sm text-blue-600">Manage billing →</p>
          </Link>
          <Link href="/company/gigs" className="rounded-xl border bg-white p-6 hover:border-blue-300 hover:shadow-sm transition">
            <p className="text-sm text-gray-500">Gigs</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">{totalGigs}</p>
            <p className="mt-2 text-sm text-blue-600">View all gigs →</p>
          </Link>
          <Link href="/company/data" className="rounded-xl border bg-white p-6 hover:border-blue-300 hover:shadow-sm transition">
            <p className="text-sm text-gray-500">Collected Data</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">{totalRecordings}</p>
            <p className="mt-2 text-sm text-blue-600">View Data Collected →</p>
          </Link>
        </div>

        {/* Recent gigs */}
        <div className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="font-semibold text-gray-900">Recent Gigs</h2>
            <Link href="/company/gigs" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {gigs && gigs.length > 0 ? (
            <ul className="divide-y">
              {gigs.map((gig) => (
                <li key={gig.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <Link
                      href={`/company/gigs/${gig.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {gig.title}
                    </Link>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {gig.filled_slots} / {gig.total_slots} slots filled
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      gig.status === "open"
                        ? "bg-green-100 text-green-700"
                        : gig.status === "completed"
                        ? "bg-blue-100 text-blue-700"
                        : gig.status === "draft"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {gig.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center text-gray-500">
              <p>No gigs yet.</p>
              <Link href="/company/gigs/new" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                Create your first gig
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
