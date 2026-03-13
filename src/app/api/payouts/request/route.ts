import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

const PayoutSchema = z.object({
  amountCents: z.number().int().min(100).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = PayoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  if (!profile.stripeOnboardingComplete) {
    return NextResponse.json(
      { error: "Stripe onboarding not complete" },
      { status: 400 }
    );
  }

  const amountCents = parsed.data.amountCents ?? profile.creditsBalanceCents;

  if (amountCents < 100) {
    return NextResponse.json(
      { error: "Minimum payout is $1.00" },
      { status: 400 }
    );
  }

  if (profile.creditsBalanceCents < amountCents) {
    return NextResponse.json(
      { error: "Insufficient balance", available: profile.creditsBalanceCents },
      { status: 400 }
    );
  }

  const payoutRequest = await prisma.payoutRequest.create({
    data: {
      userId: user.id,
      amountCents,
    },
  });

  await inngest.send({
    name: "payout/process",
    data: { payoutRequestId: payoutRequest.id },
  });

  return NextResponse.json({ payoutRequestId: payoutRequest.id }, { status: 201 });
}
