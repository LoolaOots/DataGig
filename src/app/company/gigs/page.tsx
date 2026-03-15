import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

export default async function CompanyGigsPage({ searchParams }: Props) {
  const { filter } = await searchParams;
  const activeOnly = filter === "active";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("gigs")
    .select("id, title, status, filled_slots, total_slots, activity_type, published_at, created_at")
    .eq("company_id", user.id)
    .order("created_at", { ascending: false });

  if (activeOnly) {
    query = query.eq("status", "open");
  }

  const { data: gigs } = await query;

  const isActive = (status: string) => status === "open";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/company/dashboard" className="text-gray-500 hover:text-gray-900">← Dashboard</Link>
            <h1 className="font-semibold text-gray-900">
              {activeOnly ? "Active Gigs" : "All Gigs"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/company/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link
              href="/company/gigs/new"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              + New Gig
            </Link>
          </div>
        </div>
      </nav>

      {/* Filter tabs */}
      <div className="border-b bg-white px-6">
        <div className="mx-auto flex max-w-6xl gap-1">
          <Link
            href="/company/gigs"
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              !activeOnly
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            All Gigs
          </Link>
          <Link
            href="/company/gigs?filter=active"
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeOnly
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Active
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border bg-white">
          {gigs && gigs.length > 0 ? (
            <ul className="divide-y">
              {gigs.map((gig) => (
                <li key={gig.id}>
                  <Link
                    href={`/company/gigs/${gig.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition"
                  >
                    <div>
                      <p className="font-medium text-gray-900 hover:text-blue-600">{gig.title}</p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {gig.activity_type} · {gig.filled_slots}/{gig.total_slots} slots
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {gig.published_at
                          ? `Published ${new Date(gig.published_at).toLocaleDateString()}`
                          : `Created ${new Date(gig.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isActive(gig.status)
                            ? "bg-green-100 text-green-700"
                            : gig.status === "draft"
                            ? "bg-gray-100 text-gray-600"
                            : gig.status === "completed"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {isActive(gig.status) ? "Active" : gig.status === "draft" ? "Draft" : gig.status === "completed" ? "Completed" : "Inactive"}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-16 text-center text-gray-500">
              <p>{activeOnly ? "No active gigs." : "No gigs yet."}</p>
              {!activeOnly && (
                <Link href="/company/gigs/new" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                  Create your first gig
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
