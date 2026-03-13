import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function EarningsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("credits_balance_cents, stripe_onboarding_complete")
    .eq("user_id", user.id)
    .single();

  const { data: payouts } = await supabase
    .from("payout_requests")
    .select("id, amount_cents, status, requested_at, completed_at")
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false });

  const balanceDollars = profile
    ? (profile.credits_balance_cents / 100).toFixed(2)
    : "0.00";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900">← Dashboard</Link>
          <h1 className="font-semibold text-gray-900">Earnings</h1>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Balance card */}
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-gray-500">Available Credits</p>
          <p className="mt-1 text-4xl font-semibold text-gray-900">${balanceDollars}</p>
          <div className="mt-4">
            {profile?.stripe_onboarding_complete ? (
              <form action="/api/payouts/request" method="POST">
                <button
                  type="submit"
                  disabled={!profile || profile.credits_balance_cents < 100}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Request Payout
                </button>
                <p className="mt-1 text-xs text-gray-400">Minimum $1.00 required</p>
              </form>
            ) : (
              <div>
                <p className="mb-2 text-sm text-gray-500">Set up your Stripe account to withdraw earnings.</p>
                <Link
                  href="/dashboard/payouts/setup"
                  className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Set Up Payouts
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Payout history */}
        <div className="rounded-xl border bg-white">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold text-gray-900">Payout History</h2>
          </div>
          {payouts && payouts.length > 0 ? (
            <ul className="divide-y">
              {payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">${(p.amount_cents / 100).toFixed(2)}</p>
                    <p className="text-sm text-gray-500">
                      Requested {new Date(p.requested_at).toLocaleDateString()}
                      {p.completed_at && ` · Completed ${new Date(p.completed_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      p.status === "paid"
                        ? "bg-green-100 text-green-700"
                        : p.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : p.status === "in_transit"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {p.status.replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center text-gray-500">
              No payouts yet.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
