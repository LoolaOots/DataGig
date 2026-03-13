"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminSubmissionActions({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const override = async (action: "accept" | "reject") => {
    setLoading(true);
    await fetch(`/api/admin/submissions/${submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => override("accept")}
        disabled={loading}
        className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
      >
        Accept
      </button>
      <button
        onClick={() => override("reject")}
        disabled={loading}
        className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
