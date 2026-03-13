import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gig = await prisma.gig.findUnique({
    where: { id },
    include: { labels: true },
  });

  if (!gig) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gig.companyId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (gig.status !== "draft") {
    return NextResponse.json({ error: "Gig is not in draft status" }, { status: 400 });
  }

  // Calculate escrow amount
  const escrowCents = (gig.labels as { rateCents: number; quantityNeeded: number }[]).reduce(
    (sum: number, label: { rateCents: number; quantityNeeded: number }) => sum + label.rateCents * label.quantityNeeded,
    0
  );

  // Check balance
  const company = await prisma.companyProfile.findUnique({
    where: { userId: user.id },
  });

  if (!company || company.balanceCents < escrowCents) {
    return NextResponse.json(
      {
        error: "Insufficient balance",
        required: escrowCents,
        available: company?.balanceCents ?? 0,
      },
      { status: 402 }
    );
  }

  // Transaction: deduct balance, create escrow hold, set gig open
  await prisma.$transaction([
    prisma.companyProfile.update({
      where: { userId: user.id },
      data: { balanceCents: { decrement: escrowCents } },
    }),
    prisma.ledgerEntry.create({
      data: {
        type: "escrow_hold",
        amountCents: escrowCents,
        companyId: user.id,
        description: `Escrow for gig: ${gig.title}`,
      },
    }),
    prisma.gigEscrowHold.create({
      data: {
        gigId: id,
        companyId: user.id,
        totalHeldCents: escrowCents,
      },
    }),
    prisma.gig.update({
      where: { id },
      data: { status: "open", publishedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true, escrowCents });
}
