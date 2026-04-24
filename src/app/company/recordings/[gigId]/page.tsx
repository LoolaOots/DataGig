import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import RecordingsClient from "./RecordingsClient";

interface Props {
  params: Promise<{ gigId: string }>;
}

export default async function GigRecordingsPage({ params }: Props) {
  const { gigId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify gig ownership
  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    select: { id: true, title: true, companyId: true },
  });

  if (!gig || gig.companyId !== user.id) notFound();

  // Fetch accepted submissions with non-null storage path
  // Submission has a direct gigId column, so filter directly
  const rawSubmissions = await prisma.submission.findMany({
    where: {
      status: "accepted",
      storagePath: { not: null },
      gigId: gigId,
    },
    select: {
      id: true,
      storagePath: true,
      durationSeconds: true,
      submittedAt: true,
      gigLabel: {
        select: { labelName: true },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const submissions = rawSubmissions.map((s) => ({
    id: s.id,
    storagePath: s.storagePath as string,
    durationSeconds: s.durationSeconds,
    submittedAt: s.submittedAt.toISOString(),
    labelName: s.gigLabel?.labelName ?? null,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/company/recordings" className="text-gray-500 hover:text-gray-900">
              ← Recordings
            </Link>
            <h1 className="font-semibold text-gray-900">{gig.title}</h1>
          </div>
          <Link href="/company/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            Dashboard
          </Link>
        </div>
      </nav>

      <RecordingsClient gigId={gigId} submissions={submissions} />
    </div>
  );
}
