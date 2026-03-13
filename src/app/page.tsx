import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role = "user";
  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    role = (userRow as unknown as { role: string } | null)?.role ?? "user";
  }

  const dashboardHref = role === "company" ? "/company/dashboard" : "/dashboard";

  return (
    <div className="min-h-screen bg-white">
      <TopNav links={[{ href: "/gigs", label: "Browse Gigs" }]} />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <div className="mb-4 inline-block rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
          Now in beta
        </div>
        <h1 className="mb-6 text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
          Earn money collecting<br />sensor data with your phone
        </h1>
        <p className="mb-8 mx-auto max-w-2xl text-xl text-gray-500 leading-relaxed">
          Companies need real-world motion and sensor data. You have a phone.
          DataGigs connects the two — you do the activity, earn credits, and get paid.
        </p>
        <div className="flex items-center justify-center gap-4">
          {user ? (
            <>
              <Link
                href={dashboardHref}
                className="rounded-xl bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700"
              >
                Go to dashboard →
              </Link>
              <Link
                href="/gigs"
                className="rounded-xl border border-gray-200 px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                Browse gigs
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-xl bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700"
              >
                Start collecting →
              </Link>
              <Link
                href="/signup?role=company"
                className="rounded-xl border border-gray-200 px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                Post a gig
              </Link>
            </>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-semibold text-gray-900">How it works</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Browse gigs",
                desc: "Companies post data collection campaigns — walking, running, cycling, and more.",
              },
              {
                step: "2",
                title: "Apply & get accepted",
                desc: "Apply with your device info. Accepted collectors receive a unique assignment code.",
              },
              {
                step: "3",
                title: "Collect data & earn",
                desc: "Use the DataGigs app to record and submit. Accepted submissions credit your balance instantly.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                  {item.step}
                </div>
                <h3 className="mb-2 font-semibold text-gray-900">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For companies */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 md:grid-cols-2 items-center">
            <div>
              <h2 className="mb-4 text-3xl font-semibold text-gray-900">
                For companies
              </h2>
              <p className="mb-6 text-gray-500 leading-relaxed">
                Need labeled sensor data for your ML models? Post a gig with your
                specific requirements — activity type, recording duration, accepted devices —
                and let our community do the collection.
              </p>
              <ul className="space-y-3 text-sm text-gray-600">
                {[
                  "Pay only for accepted, verified submissions",
                  "Escrow system keeps funds secure",
                  "Multi-label gigs for diverse dataset needs",
                  "Export data directly from Supabase Storage",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 text-green-500">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={user && role === "company" ? "/company/gigs/new" : "/signup?role=company"}
                className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {user && role === "company" ? "Post a new gig" : "Post your first gig"}
              </Link>
            </div>
            <div className="rounded-2xl bg-gray-50 border p-6">
              <div className="mb-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Sample gig</div>
              <h3 className="mb-1 font-semibold text-gray-900">Walking Gait Analysis</h3>
              <p className="mb-3 text-sm text-gray-500">Acme Robotics</p>
              <div className="space-y-2">
                {[
                  { label: "Normal walk", pay: "$0.75", qty: "200" },
                  { label: "Slow walk", pay: "$0.75", qty: "200" },
                  { label: "Fast walk", pay: "$1.00", qty: "100" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between rounded-lg border bg-white px-3 py-2 text-sm">
                    <span className="text-gray-700">{item.label}</span>
                    <span className="font-medium text-green-600">{item.pay} × {item.qty}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
                Total: $425.00 escrowed
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8 text-center text-sm text-gray-400">
        <p>© 2026 DataGigs. All rights reserved.</p>
      </footer>
    </div>
  );
}
