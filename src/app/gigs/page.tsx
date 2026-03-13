import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";

export default async function GigsPage() {
  const supabase = await createClient();

  const { data: gigs } = await supabase
    .from("gigs")
    .select(`
      id, title, description, activity_type, total_slots, filled_slots,
      application_deadline, data_deadline,
      company_profiles(company_name),
      gig_labels(rate_cents)
    `)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Browse Gigs</h1>
          <p className="mt-1 text-gray-500">Find sensor data collection gigs and earn credits.</p>
        </div>

        {gigs && gigs.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gigs.map((gig) => {
              const company = gig.company_profiles as unknown as { company_name: string } | null;
              const labels = gig.gig_labels as { rate_cents: number }[];
              const maxRate = labels.length
                ? Math.max(...labels.map((l) => l.rate_cents))
                : 0;
              const slotsLeft = gig.total_slots - gig.filled_slots;

              return (
                <Link
                  key={gig.id}
                  href={`/gigs/${gig.id}`}
                  className="block rounded-xl border bg-white p-5 transition hover:border-blue-300 hover:shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-gray-900 leading-snug">{gig.title}</h2>
                    {maxRate > 0 && (
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        up to ${(maxRate / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-sm text-gray-600 line-clamp-2">{gig.description}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {company && <span>{company.company_name}</span>}
                    <span>·</span>
                    <span className="capitalize">{gig.activity_type}</span>
                    <span>·</span>
                    <span>{slotsLeft} slot{slotsLeft !== 1 ? "s" : ""} left</span>
                  </div>
                  {gig.application_deadline && (
                    <p className="mt-2 text-xs text-gray-400">
                      Apply by {new Date(gig.application_deadline).toLocaleDateString()}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border bg-white px-6 py-16 text-center text-gray-500">
            <p>No open gigs at the moment. Check back soon!</p>
          </div>
        )}
      </main>
    </div>
  );
}
