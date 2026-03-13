import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("company_profiles")
    .select("company_name, balance_cents")
    .eq("user_id", user.id)
    .single();

  const { data: ledger } = await supabase
    .from("ledger_entries")
    .select("id, type, amount_cents, description, created_at")
    .eq("company_id", user.id)
    .in("type", ["deposit", "escrow_hold", "refund"])
    .order("created_at", { ascending: false })
    .limit(20);

  const balanceDollars = profile
    ? (profile.balance_cents / 100).toFixed(2)
    : "0.00";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/company/dashboard" className="text-gray-500 hover:text-gray-900">← Dashboard</Link>
          <h1 className="font-semibold text-gray-900">Billing</h1>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Balance */}
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-gray-500">Account Balance</p>
          <p className="mt-1 text-4xl font-semibold text-gray-900">${balanceDollars}</p>
          <form action="/api/stripe/checkout" method="POST" className="mt-4">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add Funds
            </button>
          </form>
        </div>

        {/* Transaction history */}
        <div className="rounded-xl border bg-white">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold text-gray-900">Transaction History</h2>
          </div>
          {ledger && ledger.length > 0 ? (
            <ul className="divide-y">
              {ledger.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900 capitalize">
                      {entry.type.replace(/_/g, " ")}
                    </p>
                    {entry.description && (
                      <p className="text-sm text-gray-500">{entry.description}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p
                    className={`font-medium ${
                      entry.type === "deposit" || entry.type === "refund"
                        ? "text-green-600"
                        : "text-gray-900"
                    }`}
                  >
                    {entry.type === "deposit" || entry.type === "refund" ? "+" : "-"}
                    ${(entry.amount_cents / 100).toFixed(2)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center text-gray-500">No transactions yet.</div>
          )}
        </div>
      </main>
    </div>
  );
}
