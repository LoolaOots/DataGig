import Link from "next/link";
import { prisma } from "@/lib/prisma";

interface SearchParams {
  page?: string;
  status?: string;
}

export default async function AdminGigsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = parseInt(sp.page ?? "1");
  const status = sp.status ?? "";
  const limit = 25;

  const where = status ? { status: status as "draft" | "open" | "paused" | "completed" | "cancelled" } : {};

  const [gigs, total] = await Promise.all([
    prisma.gig.findMany({
      where,
      include: {
        company: { select: { companyName: true } },
        _count: { select: { applications: true, labels: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.gig.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Gigs</h1>
        <p className="text-sm text-gray-500">{total} total</p>
      </div>

      {/* Status filter */}
      <form className="mb-4 flex gap-2">
        {["", "draft", "open", "paused", "completed", "cancelled"].map((s) => (
          <button
            key={s}
            name="status"
            value={s}
            type="submit"
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              status === s
                ? "bg-gray-900 text-white"
                : "border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </form>

      <div className="rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Company</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Slots</th>
              <th className="px-4 py-3 text-right">Apps</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {gigs.map((gig) => (
              <tr key={gig.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 truncate max-w-[200px]">{gig.title}</p>
                  <p className="text-xs text-gray-400 capitalize">{gig.activityType}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{gig.company.companyName}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {gig.filledSlots}/{gig.totalSlots}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {gig._count.applications}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(gig.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`?page=${page - 1}&status=${status}`} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
              ← Prev
            </Link>
          )}
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`?page=${page + 1}&status=${status}`} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
