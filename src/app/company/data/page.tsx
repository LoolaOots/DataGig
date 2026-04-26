import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

export default async function CompanyRecordingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch gigs owned by this company with eligible statuses
  // Include submissions via the applications chain: gig → applications → submissions
  const gigs = await prisma.gig.findMany({
    where: {
      companyId: user.id,
      status: { in: ["open", "paused", "completed"] },
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      applications: {
        select: {
          submissions: {
            where: {
              status: "accepted",
              storagePath: { not: null },
            },
            select: {
              submittedAt: true,
            },
          },
        },
      },
    },
  });

  // Compute recording count and last submitted time per gig
  const gigsWithCounts = gigs
    .map((gig) => {
      const allSubmissions = gig.applications.flatMap((a) => a.submissions);
      const recordingCount = allSubmissions.length;
      const lastSubmittedAt =
        allSubmissions.length > 0
          ? new Date(
              Math.max(...allSubmissions.map((s) => s.submittedAt.getTime()))
            )
          : null;
      return {
        id: gig.id,
        title: gig.title,
        createdAt: gig.createdAt,
        recordingCount,
        lastSubmittedAt,
      };
    })
    .sort((a, b) => {
      if (!a.lastSubmittedAt && !b.lastSubmittedAt)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (!a.lastSubmittedAt) return 1;
      if (!b.lastSubmittedAt) return -1;
      return b.lastSubmittedAt.getTime() - a.lastSubmittedAt.getTime();
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/company/dashboard" className="text-gray-500 hover:text-gray-900">
              ← Dashboard
            </Link>
            <h1 className="font-semibold text-gray-900">Data</h1>
          </div>
          <Link href="/company/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {gigsWithCounts.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <p>No gigs with recordings yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-white divide-y">
            {gigsWithCounts.map((gig) => (
              <Link
                key={gig.id}
                href={`/company/data/${gig.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition"
              >
                <div>
                  <p className="font-medium text-gray-900">{gig.title}</p>
                  {gig.recordingCount > 0 ? (
                    <p className="mt-0.5 text-sm text-gray-500">
                      {gig.recordingCount} recordings · Last submitted{" "}
                      <strong className="font-medium text-gray-900">
                        {formatRelativeTime(gig.lastSubmittedAt!)}
                      </strong>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm text-gray-400">No recordings yet</p>
                  )}
                </div>
                <span className="text-gray-400 text-base">›</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
