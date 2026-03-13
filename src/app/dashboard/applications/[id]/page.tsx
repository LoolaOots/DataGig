import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: app } = await supabase
    .from("applications")
    .select(`
      id, status, assignment_code, device_type, note_from_user,
      note_from_company, applied_at, reviewed_at,
      gigs(id, title, description, activity_type, data_deadline,
        gig_labels(id, label_name, description, duration_seconds, rate_cents),
        gig_device_requirements(device_type)
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!app) notFound();

  const gig = app.gigs as unknown as {
    id: string; title: string; description: string; activity_type: string; data_deadline: string | null;
    gig_labels: { id: string; label_name: string; description: string | null; duration_seconds: number; rate_cents: number }[];
  } | null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <Link href="/dashboard/applications" className="text-gray-500 hover:text-gray-900">← Applications</Link>
          <h1 className="font-semibold text-gray-900">{gig?.title ?? "Application"}</h1>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {/* Status banner */}
        <div className={`rounded-xl border p-4 ${
          app.status === "accepted" ? "border-green-200 bg-green-50"
          : app.status === "denied" ? "border-red-200 bg-red-50"
          : "border-yellow-200 bg-yellow-50"
        }`}>
          <p className="font-medium capitalize text-gray-900">Status: {app.status}</p>
          {app.note_from_company && (
            <p className="mt-1 text-sm text-gray-600">Note from company: {app.note_from_company}</p>
          )}
        </div>

        {/* Assignment code (if accepted) */}
        {app.status === "accepted" && app.assignment_code && (
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-3 font-semibold text-gray-900">Assignment Code</h2>
            <p className="mb-2 text-sm text-gray-500">
              Use this code in the DataGigs phone app to submit sensor data.
            </p>
            <div className="rounded-lg bg-gray-100 px-4 py-3 font-mono text-xl font-bold tracking-widest text-gray-900">
              {app.assignment_code}
            </div>
            {gig?.data_deadline && (
              <p className="mt-2 text-sm text-gray-500">
                Data due by: {new Date(gig.data_deadline).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Gig details */}
        {gig && (
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-3 font-semibold text-gray-900">Gig Details</h2>
            <p className="mb-4 text-sm text-gray-600">{gig.description}</p>
            <h3 className="mb-2 text-sm font-medium text-gray-700">Labels to collect:</h3>
            <ul className="space-y-2">
              {gig.gig_labels.map((label) => (
                <li key={label.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{label.label_name}</p>
                    {label.description && <p className="text-sm text-gray-500">{label.description}</p>}
                    <p className="text-xs text-gray-400">{label.duration_seconds}s recording</p>
                  </div>
                  <p className="font-medium text-green-600">
                    ${(label.rate_cents / 100).toFixed(2)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Your note */}
        {app.note_from_user && (
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-2 font-semibold text-gray-900">Your Note</h2>
            <p className="text-sm text-gray-600">{app.note_from_user}</p>
          </div>
        )}
      </main>
    </div>
  );
}
