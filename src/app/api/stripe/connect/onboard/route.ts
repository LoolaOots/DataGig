import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (userRow?.role !== "user") {
    return NextResponse.json({ error: "Only data collectors can set up payouts" }, { status: 403 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    include: { user: true },
  });

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Get or create Stripe Express account
  let accountId = profile.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: profile.user.email,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: { userId: user.id },
    });
    accountId = account.id;
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { stripeAccountId: accountId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/dashboard/payouts/setup`,
    return_url: `${appUrl}/dashboard/earnings?onboarding=complete`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(accountLink.url, { status: 303 });
}
