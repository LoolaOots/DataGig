import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AdminSubmissionActions from "./AdminSubmissionActions";

interface SearchParams {
  page?: string;
  status?: string;
}

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = parseInt(sp.page ?? "1");
  const status = sp.status ?? "pending_review";
  const limit = 25;

  const where = { status: status as "pending_review" | "accepted" | "rejected" };

  const [submissions, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      include: {
        gigLabel: { select: { labelName: true, rateCents: true, gig: { select: { title: true } } } },
        application: {
          select: { user: { select: { email: true } } },
        },
      },
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.submission.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Submissions</h1>
        <p className="text-sm text-gray-500">{total} total</p>
      </div>

      {/* Status filter */}
      <form className="mb-4 flex gap-2">
        {["pending_review", "accepted", "rejected"].map((s) => (
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
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </form>

      <div className="rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Gig / Label</th>
              <th className="px-4 py-3 text-left">Collector</th>
              <th className="px-4 py-3 text-left">Device</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Submitted</th>
              {status === "pending_review" && (
                <th className="px-4 py-3 text-center">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {submissions.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 text-xs">
                    {sub.gigLabel.gig.title}
                  </p>
                  <p className="text-gray-500 text-xs">{sub.gigLabel.labelName}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {sub.application.user.email}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {sub.deviceType.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3 text-right text-xs font-medium text-green-600">
                  ${(sub.gigLabel.rateCents / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      sub.status === "accepted"
                        ? "bg-green-100 text-green-700"
                        : sub.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {sub.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(sub.submittedAt).toLocaleDateString()}
                </td>
                {status === "pending_review" && (
                  <td className="px-4 py-3">
                    <AdminSubmissionActions submissionId={sub.id} />
                  </td>
                )}
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
