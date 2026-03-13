import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GigDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: gig } = await supabase
    .from("gigs")
    .select(`
      id, title, description, activity_type, status, total_slots, filled_slots,
      application_deadline, data_deadline, published_at,
      company_profiles(company_name, logo_url, website_url),
      gig_labels(id, label_name, description, duration_seconds, rate_cents, quantity_needed, quantity_fulfilled),
      gig_device_requirements(device_type)
    `)
    .eq("id", id)
    .single();

  if (!gig || (gig.status !== "open" && gig.status !== "paused")) notFound();

  const company = gig.company_profiles as unknown as { company_name: string; logo_url: string | null; website_url: string | null } | null;
  const labels = gig.gig_labels as {
    id: string; label_name: string; description: string | null;
    duration_seconds: number; rate_cents: number; quantity_needed: number; quantity_fulfilled: number;
  }[];
  const devices = gig.gig_device_requirements as { device_type: string }[];

  const totalEarnable = labels.reduce(
    (sum, l) => sum + l.rate_cents * l.quantity_needed,
    0
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Check if user already applied
  let alreadyApplied = false;
  if (user) {
    const { data: app } = await supabase
      .from("applications")
      .select("id")
      .eq("gig_id", id)
      .eq("user_id", user.id)
      .single();
    alreadyApplied = !!app;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav links={[{ href: "/gigs", label: "Browse Gigs" }]} />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border bg-white p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{gig.title}</h1>
                  {company && (
                    <p className="mt-1 text-sm text-gray-500">{company.company_name}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    gig.status === "open" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {gig.status}
                </span>
              </div>
              <p className="text-gray-600">{gig.description}</p>
            </div>

            {/* Labels */}
            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 font-semibold text-gray-900">Data Labels to Collect</h2>
              <ul className="space-y-3">
                {labels.map((label) => (
                  <li key={label.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{label.label_name}</p>
                        {label.description && (
                          <p className="mt-0.5 text-sm text-gray-500">{label.description}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-400">
                          {label.duration_seconds}s recording · {label.quantity_needed - label.quantity_fulfilled} of {label.quantity_needed} still needed
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold text-green-600">
                        ${(label.rate_cents / 100).toFixed(2)} each
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-5">
              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Activity</span>
                  <span className="font-medium capitalize text-gray-900">{gig.activity_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Slots</span>
                  <span className="font-medium text-gray-900">
                    {gig.filled_slots} / {gig.total_slots}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Max Earnings</span>
                  <span className="font-medium text-green-600">
                    ${(totalEarnable / 100).toFixed(2)}
                  </span>
                </div>
                {gig.application_deadline && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Apply by</span>
                    <span className="font-medium text-gray-900">
                      {new Date(gig.application_deadline).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {gig.data_deadline && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Data due</span>
                    <span className="font-medium text-gray-900">
                      {new Date(gig.data_deadline).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Devices */}
              {devices.length > 0 && (
                <div className="mb-4">
                  <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">Accepted Devices</p>
                  <div className="flex flex-wrap gap-1">
                    {devices.map((d) => (
                      <span key={d.device_type} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {d.device_type.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {user ? (
                alreadyApplied ? (
                  <Link
                    href="/dashboard/applications"
                    className="block w-full rounded-lg bg-gray-100 px-4 py-2.5 text-center text-sm font-medium text-gray-600"
                  >
                    Already applied
                  </Link>
                ) : (
                  <Link
                    href={`/gigs/${id}/apply`}
                    className="block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Apply Now
                  </Link>
                )
              ) : (
                <Link
                  href={`/signup?next=/gigs/${id}`}
                  className="block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
                >
                  Sign up to Apply
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
