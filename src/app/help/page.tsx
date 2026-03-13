import TopNav from "@/components/TopNav";
import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">Help & Support</h1>
        <p className="mb-8 text-sm text-gray-500">
          We&apos;re here to help. Reach out any time.
        </p>

        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-2 font-semibold text-gray-900">Contact Support</h2>
            <p className="mb-4 text-sm text-gray-600">
              Have a question, ran into an issue, or want to give feedback? Send
              us an email and we&apos;ll get back to you as soon as possible.
            </p>
            <a
              href="mailto:looladev@gmail.com"
              className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Email us at looladev@gmail.com
            </a>
          </div>

          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-3 font-semibold text-gray-900">FAQs</h2>
            <ul className="space-y-4 text-sm text-gray-600">
              <li>
                <p className="font-medium text-gray-900">How do I earn credits?</p>
                <p className="mt-0.5">
                  Apply to open gigs, get accepted, then collect sensor data with
                  your phone. Each accepted submission earns you credits at the
                  rate listed on the gig.
                </p>
              </li>
              <li>
                <p className="font-medium text-gray-900">How do I withdraw my earnings?</p>
                <p className="mt-0.5">
                  Set up payouts from your{" "}
                  <Link href="/dashboard/payouts/setup" className="text-blue-600 hover:underline">
                    earnings page
                  </Link>
                  . We use Stripe to send funds directly to your bank account.
                </p>
              </li>
              <li>
                <p className="font-medium text-gray-900">How do I post a gig as a company?</p>
                <p className="mt-0.5">
                  Sign up with a company account, add funds to your balance, then
                  create a new gig from your{" "}
                  <Link href="/company/dashboard" className="text-blue-600 hover:underline">
                    company dashboard
                  </Link>
                  .
                </p>
              </li>
              <li>
                <p className="font-medium text-gray-900">My submission was rejected — what now?</p>
                <p className="mt-0.5">
                  Check the feedback on your submission and try again. If you
                  think it was rejected in error, contact us at{" "}
                  <a href="mailto:looladev@gmail.com" className="text-blue-600 hover:underline">
                    looladev@gmail.com
                  </a>
                  .
                </p>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
