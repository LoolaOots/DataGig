"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DepositSuccess() {
  const router = useRouter();

  useEffect(() => {
    // Refresh page data after a short delay to let the webhook process
    const timer = setTimeout(() => router.refresh(), 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-5">
      <h2 className="text-lg font-semibold text-green-700">Deposit successful!</h2>
      <p className="mt-1 text-sm text-green-600">
        Your funds are being added to your account. Balance will update momentarily…
      </p>
    </div>
  );
}
