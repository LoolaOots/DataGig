import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PayoutSetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("stripe_onboarding_complete")
    .eq("user_id", user.id)
    .single();

  if (profile?.stripe_onboarding_complete) {
    redirect("/dashboard/earnings");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">Set Up Payouts</h1>
        <p className="mb-6 text-gray-600">
          Connect your Stripe account to receive earnings from your sensor data submissions.
          This is a one-time setup via Stripe Express.
        </p>
        <ul className="mb-6 space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-green-500">✓</span>
            Fast, secure payouts via Stripe
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-green-500">✓</span>
            Supports bank transfers in 40+ countries
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-green-500">✓</span>
            Your financial data stays private with Stripe
          </li>
        </ul>
        <form action="/api/stripe/connect/onboard" method="POST">
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Connect with Stripe
          </button>
        </form>
        <Link
          href="/dashboard"
          className="mt-4 block text-center text-sm text-gray-500 hover:text-gray-700"
        >
          Set up later
        </Link>
      </div>
    </div>
  );
}
