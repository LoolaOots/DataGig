import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // KPIs — run in parallel
  const [
    totalUsers,
    totalCompanies,
    openGigs,
    totalGigs,
    pendingSubmissions,
    acceptedSubmissions,
    totalDeposited,
    totalPaidOut,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "user" } }),
    prisma.user.count({ where: { role: "company" } }),
    prisma.gig.count({ where: { status: "open" } }),
    prisma.gig.count(),
    prisma.submission.count({ where: { status: "pending_review" } }),
    prisma.submission.count({ where: { status: "accepted" } }),
    prisma.ledgerEntry.aggregate({
      where: { type: "deposit" },
      _sum: { amountCents: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { type: "payout" },
      _sum: { amountCents: true },
    }),
  ]);

  // Recent activity
  const { data: recentUsers } = await supabase
    .from("users")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const kpis = [
    { label: "Data Collectors", value: totalUsers },
    { label: "Companies", value: totalCompanies },
    { label: "Open Gigs", value: openGigs },
    { label: "Total Gigs", value: totalGigs },
    { label: "Pending Submissions", value: pendingSubmissions },
    { label: "Accepted Submissions", value: acceptedSubmissions },
    {
      label: "Total Deposited",
      value: `$${((totalDeposited._sum.amountCents ?? 0) / 100).toFixed(2)}`,
    },
    {
      label: "Total Paid Out",
      value: `$${((totalPaidOut._sum.amountCents ?? 0) / 100).toFixed(2)}`,
    },
  ];

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Admin Dashboard</h1>

      {/* KPI grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border bg-white p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{kpi.label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Recent signups */}
      <div className="rounded-xl border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">Recent Signups</h2>
        </div>
        <ul className="divide-y">
          {recentUsers?.map((u) => (
            <li key={u.id} className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{u.email}</p>
                <p className="text-xs text-gray-400">
                  {new Date(u.created_at).toLocaleString()}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  u.role === "company"
                    ? "bg-purple-100 text-purple-700"
                    : u.role === "admin"
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {u.role}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
