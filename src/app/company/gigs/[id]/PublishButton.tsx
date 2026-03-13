"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PublishButton({ gigId }: { gigId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handlePublish() {
    setLoading(true);
    const res = await fetch(`/api/gigs/${gigId}/publish`, { method: "POST" });

    if (res.ok) {
      router.refresh();
      return;
    }

    const data = await res.json().catch(() => ({}));

    if (res.status === 402) {
      const params = new URLSearchParams({
        insufficient: "1",
        required: String(data.required ?? 0),
        available: String(data.available ?? 0),
      });
      router.push(`/company/billing?${params.toString()}`);
      return;
    }

    setLoading(false);
    alert(data.error ?? "Failed to publish gig.");
  }

  return (
    <button
      onClick={handlePublish}
      disabled={loading}
      className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
    >
      {loading ? "Publishing…" : "Publish Gig"}
    </button>
  );
}
