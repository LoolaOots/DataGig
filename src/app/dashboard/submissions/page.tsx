import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function SubmissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: submissions } = await supabase
    .from("submissions")
    .select(`
      id, status, duration_seconds, submitted_at,
      gig_labels(label_name, rate_cents),
      applications(gigs(title))
    `)
    .eq("applications.user_id", user.id)
    .order("submitted_at", { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900">← Dashboard</Link>
          <h1 className="font-semibold text-gray-900">My Submissions</h1>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border bg-white">
          {submissions && submissions.length > 0 ? (
            <ul className="divide-y">
              {submissions.map((sub) => {
                const label = sub.gig_labels as unknown as { label_name: string; rate_cents: number } | null;
                const gigTitle = (sub.applications as unknown as { gigs: { title: string } | null } | null)?.gigs?.title;
                return (
                  <li key={sub.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{gigTitle ?? "Gig"} — {label?.label_name}</p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {sub.duration_seconds ? `${sub.duration_seconds}s` : "—"} ·{" "}
                        {new Date(sub.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {label && sub.status === "accepted" && (
                        <p className="text-sm font-medium text-green-600">
                          +${(label.rate_cents / 100).toFixed(2)}
                        </p>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          sub.status === "accepted"
                            ? "bg-green-100 text-green-700"
                            : sub.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {sub.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-6 py-16 text-center text-gray-500">
              <p>No submissions yet. Get accepted to a gig and start collecting data.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
