"use client";

import { useState } from "react";

const AMOUNTS = [
  { label: "$50", cents: 5000 },
  { label: "$100", cents: 10000 },
  { label: "$250", cents: 25000 },
  { label: "$500", cents: 50000 },
];

export default function AddFundsButton() {
  const [selected, setSelected] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAddFunds() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: selected }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error ?? "Failed to start checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        {AMOUNTS.map((a) => (
          <button
            key={a.cents}
            onClick={() => setSelected(a.cents)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              selected === a.cents
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={handleAddFunds}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Redirecting to Stripe…" : `Add ${AMOUNTS.find((a) => a.cents === selected)?.label ?? ""}`}
      </button>
    </div>
  );
}
