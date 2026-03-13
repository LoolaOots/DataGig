import TopNav from "@/components/TopNav";

export default function CompanySupportPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav links={[{ href: "/company/dashboard", label: "Dashboard" }]} />

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">Business Support</h1>
        <p className="mb-8 text-sm text-gray-500">
          A DataGigs representative is here to help you get the most out of the platform.
        </p>

        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-2 font-semibold text-gray-900">Get in Touch</h2>
            <p className="mb-4 text-sm text-gray-600">
              Send us a business inquiry and a company representative will reach out to
              help you and provide more information tailored to your needs.
            </p>
            <a
              href="mailto:loolaapps@gmail.com"
              className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Email us at loolaapps@gmail.com
            </a>
          </div>

          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-900">How a Representative Can Help</h2>
            <ul className="space-y-4">
              {[
                {
                  title: "Creating a gig",
                  desc: "Walk through setting up your data collection campaign — activity types, labels, pay rates, deadlines, and device requirements.",
                },
                {
                  title: "Accepting users for your gigs",
                  desc: "Learn how to review applicants, accept or deny them, and manage your collector roster effectively.",
                },
                {
                  title: "Data verification before payout",
                  desc: "Understand how submitted sensor data is verified for quality and accuracy before credits are released to collectors.",
                },
                {
                  title: "Billing and escrow",
                  desc: "Get guidance on funding your account, how the escrow system works, and how refunds are handled.",
                },
                {
                  title: "Any other questions",
                  desc: "Whether it's about exporting data, custom requirements, volume pricing, or anything else — we're happy to help.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3">
                  <span className="mt-0.5 flex-shrink-0 text-blue-500">✓</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="mt-0.5 text-sm text-gray-500">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
