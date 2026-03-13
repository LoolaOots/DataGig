import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function CompanyGigsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: gigs } = await supabase
    .from("gigs")
    .select("id, title, status, filled_slots, total_slots, activity_type, published_at, created_at")
    .eq("company_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/company/dashboard" className="text-gray-500 hover:text-gray-900">← Dashboard</Link>
          <h1 className="font-semibold text-gray-900">My Gigs</h1>
          <div className="ml-auto">
            <Link
              href="/company/gigs/new"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              + New Gig
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border bg-white">
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
                    <Link
                      href={`/company/gigs/${gig.id}/applications`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Applications
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-16 text-center text-gray-500">
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
