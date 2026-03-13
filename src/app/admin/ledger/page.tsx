import { prisma } from "@/lib/prisma";
import Link from "next/link";

interface SearchParams {
  page?: string;
  type?: string;
}

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = parseInt(sp.page ?? "1");
  const type = sp.type ?? "";
  const limit = 30;

  const where = type
    ? { type: type as "deposit" | "escrow_hold" | "escrow_release" | "payout" | "refund" | "platform_fee" }
    : {};

  const [entries, total, totals] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      include: {
        company: { select: { companyName: true } },
        user: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ledgerEntry.count({ where }),
    prisma.ledgerEntry.groupBy({
      by: ["type"],
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  const typeColors: Record<string, string> = {
    deposit: "bg-green-100 text-green-700",
    escrow_hold: "bg-yellow-100 text-yellow-700",
    escrow_release: "bg-blue-100 text-blue-700",
    payout: "bg-purple-100 text-purple-700",
    refund: "bg-orange-100 text-orange-700",
    platform_fee: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Ledger</h1>
        <p className="text-sm text-gray-500">{total} entries</p>
      </div>

      {/* Totals by type */}
      <div className="mb-6 grid grid-cols-3 gap-3 lg:grid-cols-6">
        {totals.map((t) => (
          <div key={t.type} className="rounded-lg border bg-white p-3">
            <p className="text-xs text-gray-400 capitalize">{t.type.replace(/_/g, " ")}</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900">
              ${((t._sum.amountCents ?? 0) / 100).toFixed(0)}
            </p>
            <p className="text-xs text-gray-400">{t._count} txns</p>
          </div>
        ))}
      </div>

      {/* Type filter */}
      <form className="mb-4 flex flex-wrap gap-2">
        {["", "deposit", "escrow_hold", "escrow_release", "payout", "refund", "platform_fee"].map((t) => (
          <button
            key={t}
            name="type"
            value={t}
            type="submit"
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              type === t
                ? "bg-gray-900 text-white"
                : "border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.replace(/_/g, " ") || "All"}
          </button>
        ))}
      </form>

      <div className="rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Company</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      typeColors[entry.type] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {entry.type.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  ${(entry.amountCents / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[120px]">
                  {entry.company?.companyName ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[140px]">
                  {entry.user?.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 truncate max-w-[150px]">
                  {entry.description ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`?page=${page - 1}&type=${type}`} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
              ← Prev
            </Link>
          )}
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`?page=${page + 1}&type=${type}`} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
