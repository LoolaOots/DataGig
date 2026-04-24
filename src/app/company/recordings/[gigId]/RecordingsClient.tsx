"use client";

interface Submission {
  id: string;
  storagePath: string;
  durationSeconds: number | null;
  submittedAt: string;
  labelName: string | null;
}

interface Props {
  gigId: string;
  submissions: Submission[];
}

export default function RecordingsClient({ submissions }: Props) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-gray-500">Loading... ({submissions.length} submissions)</p>
    </main>
  );
}
