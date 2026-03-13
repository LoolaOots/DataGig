import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const DEPOSIT_AMOUNTS = [
  { label: "$50", cents: 5000 },
  { label: "$100", cents: 10000 },
  { label: "$250", cents: 25000 },
  { label: "$500", cents: 50000 },
];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (userRow?.role !== "company") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const amountCents: number = body.amountCents ?? 10000;

  const validAmount = DEPOSIT_AMOUNTS.find((d) => d.cents === amountCents);
  if (!validAmount) {
    return NextResponse.json(
      { error: "Invalid amount", valid: DEPOSIT_AMOUNTS.map((d) => d.cents) },
      { status: 400 }
    );
  }

  // Get or create Stripe customer
  let company = await prisma.companyProfile.findUnique({
    where: { userId: user.id },
    include: { user: true },
  });

  if (!company) {
    return NextResponse.json({ error: "Company profile not found" }, { status: 404 });
  }

  let customerId = company.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: company.user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.companyProfile.update({
      where: { userId: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card", "us_bank_account"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "DataGigs Account Credit",
            description: `Add $${(amountCents / 100).toFixed(2)} to your DataGigs balance`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: { userId: user.id, amountCents: amountCents.toString() },
    success_url: `${appUrl}/company/billing?deposit=success`,
    cancel_url: `${appUrl}/company/billing?deposit=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
