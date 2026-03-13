import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CompanyGigDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: gig } = await supabase
    .from("gigs")
    .select(`
      id, title, description, activity_type, status, total_slots, filled_slots,
      application_deadline, data_deadline, published_at, created_at,
      gig_labels(id, label_name, description, duration_seconds, rate_cents, quantity_needed, quantity_fulfilled),
      gig_device_requirements(device_type),
      gig_escrow_holds(total_held_cents, released_cents)
    `)
    .eq("id", id)
    .eq("company_id", user.id)
    .single();

  if (!gig) notFound();

  const labels = gig.gig_labels as {
    id: string; label_name: string; description: string | null;
    duration_seconds: number; rate_cents: number; quantity_needed: number; quantity_fulfilled: number;
  }[];

  const escrow = gig.gig_escrow_holds as { total_held_cents: number; released_cents: number }[] | null;
  const escrowHold = escrow?.[0];

  const { data: applications } = await supabase
    .from("applications")
    .select("id, status, applied_at, device_type, user_profiles(display_name)")
    .eq("gig_id", id)
    .order("applied_at", { ascending: false })
    .limit(10);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/company/gigs" className="text-gray-500 hover:text-gray-900">← Gigs</Link>
            <h1 className="font-semibold text-gray-900">{gig.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {gig.status === "draft" && (
              <form action={`/api/gigs/${id}/publish`} method="POST">
                <button
                  type="submit"
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                >
                  Publish Gig
                </button>
              </form>
            )}
            <Link
              href={`/company/gigs/${id}/applications`}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Review Applications
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-2 font-semibold text-gray-900">Description</h2>
              <p className="text-gray-600 text-sm">{gig.description}</p>
            </div>

            {/* Labels */}
            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 font-semibold text-gray-900">Labels</h2>
              <ul className="space-y-3">
                {labels.map((label) => (
                  <li key={label.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{label.label_name}</p>
                        {label.description && (
                          <p className="text-sm text-gray-500">{label.description}</p>
                        )}
                        <div className="mt-1 text-xs text-gray-400">
                          {label.duration_seconds}s · {label.quantity_fulfilled}/{label.quantity_needed} collected
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                          <div
                            className="h-1.5 rounded-full bg-green-500"
                            style={{ width: `${Math.min(100, (label.quantity_fulfilled / label.quantity_needed) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <p className="ml-4 font-medium text-green-600">
                        ${(label.rate_cents / 100).toFixed(2)}/ea
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recent applications */}
            {applications && applications.length > 0 && (
              <div className="rounded-xl border bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Recent Applications</h2>
                  <Link href={`/company/gigs/${id}/applications`} className="text-sm text-blue-600 hover:underline">
                    View all
                  </Link>
                </div>
                <ul className="space-y-2">
                  {applications.map((app) => {
                    const profile = app.user_profiles as unknown as { display_name: string | null } | null;
                    return (
                      <li key={app.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{profile?.display_name ?? "User"}</p>
                          <p className="text-xs text-gray-400">
                            {app.device_type.replace(/_/g, " ")} · Applied {new Date(app.applied_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            app.status === "accepted" ? "bg-green-100 text-green-700"
                            : app.status === "denied" ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {app.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  gig.status === "open" ? "bg-green-100 text-green-700"
                  : gig.status === "draft" ? "bg-gray-100 text-gray-600"
                  : "bg-blue-100 text-blue-700"
                }`}>{gig.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Slots</span>
                <span className="font-medium text-gray-900">{gig.filled_slots} / {gig.total_slots}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Activity</span>
                <span className="font-medium text-gray-900 capitalize">{gig.activity_type}</span>
              </div>
              {escrowHold && (
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-500">Escrowed</span>
                  <span className="font-medium text-gray-900">
                    ${(escrowHold.total_held_cents / 100).toFixed(2)}
                  </span>
                </div>
              )}
              {gig.application_deadline && (
                <div className="flex justify-between">
                  <span className="text-gray-500">App deadline</span>
                  <span className="text-gray-900">{new Date(gig.application_deadline).toLocaleDateString()}</span>
                </div>
              )}
              {gig.data_deadline && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Data deadline</span>
                  <span className="text-gray-900">{new Date(gig.data_deadline).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
