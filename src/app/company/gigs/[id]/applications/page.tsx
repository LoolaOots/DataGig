"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Application {
  id: string;
  status: string;
  device_type: string;
  note_from_user: string | null;
  applied_at: string;
  user_profiles: { display_name: string | null; bio: string | null } | null;
}

export default function GigApplicationsPage() {
  const params = useParams();
  const gigId = params.id as string;
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId]);

  const fetchApplications = async () => {
    const res = await fetch(`/api/applications?gigId=${gigId}`);
    if (res.ok) {
      const data = await res.json();
      setApplications(data);
    }
  };

  const review = async (applicationId: string, action: "accept" | "deny") => {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to update");
      return;
    }

    await fetchApplications();
  };

  const pending = applications.filter((a) => a.status === "pending");
  const reviewed = applications.filter((a) => a.status !== "pending");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/company/gigs/${gigId}`} className="text-gray-500 hover:text-gray-900">← Gig</Link>
            <h1 className="font-semibold text-gray-900">Applications</h1>
          </div>
          <Link href="/company/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div>
          <h2 className="mb-3 font-semibold text-gray-900">Pending ({pending.length})</h2>
          {pending.length > 0 ? (
            <ul className="space-y-3">
              {pending.map((app) => (
                <li key={app.id} className="rounded-xl border bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {app.user_profiles?.display_name ?? "User"}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {app.device_type.replace(/_/g, " ")} ·{" "}
                        Applied {new Date(app.applied_at).toLocaleDateString()}
                      </p>
                      {app.note_from_user && (
                        <p className="mt-2 text-sm text-gray-600 italic">&ldquo;{app.note_from_user}&rdquo;</p>
                      )}
                      {app.user_profiles?.bio && (
                        <p className="mt-1 text-sm text-gray-500">{app.user_profiles.bio}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => review(app.id, "accept")}
                        disabled={loading}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => review(app.id, "deny")}
                        disabled={loading}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No pending applications.</p>
          )}
        </div>

        {reviewed.length > 0 && (
          <div>
            <h2 className="mb-3 font-semibold text-gray-900">Reviewed ({reviewed.length})</h2>
            <ul className="space-y-2">
              {reviewed.map((app) => (
                <li key={app.id} className="flex items-center justify-between rounded-xl border bg-white px-5 py-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {app.user_profiles?.display_name ?? "User"}
                    </p>
                    <p className="text-sm text-gray-500">{app.device_type.replace(/_/g, " ")}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      app.status === "accepted"
                        ? "bg-green-100 text-green-700"
                        : app.status === "denied"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {app.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
