"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type DeviceType = "apple_watch" | "generic_android" | "generic_ios";

const deviceLabels: Record<DeviceType, string> = {
  apple_watch: "Apple Watch",
  generic_android: "Android",
  generic_ios: "iPhone / iPad",
};

interface Gig {
  title: string;
  activity_type: string;
  gig_device_requirements: { device_type: DeviceType }[];
}

export default function ApplyPage() {
  const params = useParams();
  const gigId = params.id as string;
  const router = useRouter();

  const [gig, setGig] = useState<Gig | null>(null);
  const [deviceType, setDeviceType] = useState<DeviceType>("generic_ios");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/gigs/${gigId}`)
      .then((r) => r.json())
      .then(setGig);
  }, [gigId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gigId, deviceType, noteFromUser: note || undefined }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to submit application");
      return;
    }

    router.push("/dashboard/applications?applied=true");
  };

  const allowedDevices = gig?.gig_device_requirements.map((r) => r.device_type) ?? [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <Link href={`/gigs/${gigId}`} className="mb-4 block text-sm text-gray-500 hover:text-gray-700">
          ← Back to gig
        </Link>
        <h1 className="mb-1 text-xl font-semibold text-gray-900">
          Apply to {gig?.title ?? "..."}
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Activity: {gig?.activity_type ?? "..."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Your device *</label>
            <div className="grid grid-cols-1 gap-2">
              {allowedDevices.map((dt) => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setDeviceType(dt)}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-medium text-left transition ${
                    deviceType === dt
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {deviceLabels[dt]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Note to company <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Anything the company should know about you..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !gig}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}
