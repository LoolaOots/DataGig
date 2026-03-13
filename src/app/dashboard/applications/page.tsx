import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: applications } = await supabase
    .from("applications")
    .select("id, status, device_type, applied_at, gigs(id, title, activity_type)")
    .eq("user_id", user.id)
    .order("applied_at", { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900">← Dashboard</Link>
          <h1 className="font-semibold text-gray-900">My Applications</h1>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border bg-white">
          {applications && applications.length > 0 ? (
            <ul className="divide-y">
              {applications.map((app) => {
                const gig = app.gigs as unknown as { id: string; title: string; activity_type: string } | null;
                return (
                  <li key={app.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <Link
                        href={`/dashboard/applications/${app.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {gig?.title ?? "Gig"}
                      </Link>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {gig?.activity_type} · {app.device_type.replace(/_/g, " ")}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        Applied {new Date(app.applied_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
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
                      <Link
                        href={`/dashboard/applications/${app.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-6 py-16 text-center text-gray-500">
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
