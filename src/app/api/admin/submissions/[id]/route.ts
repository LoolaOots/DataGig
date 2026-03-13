import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

const OverrideSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (userRow?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = OverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { action } = parsed.data;

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      gigLabel: true,
      application: { include: { user: true, gig: { include: { company: true } } } },
    },
  });

  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (submission.status !== "pending_review") {
    return NextResponse.json({ error: "Submission already reviewed" }, { status: 400 });
  }

  if (action === "accept") {
    await prisma.$transaction([
      prisma.submission.update({
        where: { id },
        data: { status: "accepted", verifiedAt: new Date() },
      }),
      prisma.ledgerEntry.create({
        data: {
          type: "escrow_release",
          amountCents: submission.gigLabel.rateCents,
          companyId: submission.application.gig.companyId,
          userId: submission.application.userId,
          submissionId: id,
          description: `Admin override: accepted ${submission.gigLabel.labelName}`,
        },
      }),
      prisma.userProfile.update({
        where: { userId: submission.application.userId },
        data: {
          creditsBalanceCents: { increment: submission.gigLabel.rateCents },
        },
      }),
      prisma.gigLabel.update({
        where: { id: submission.gigLabelId },
        data: { quantityFulfilled: { increment: 1 } },
      }),
    ]);

    await prisma.notification.create({
      data: {
        userId: submission.application.userId,
        type: "submission_accepted",
        title: "Submission accepted",
        body: `+$${(submission.gigLabel.rateCents / 100).toFixed(2)} added to your balance.`,
        metadata: { submissionId: id },
      },
    });

    // Check if gig should be marked complete
    await inngest.send({
      name: "gig/check-completion",
      data: { gigId: submission.application.gigId },
    });
  } else {
    await prisma.submission.update({
      where: { id },
      data: { status: "rejected", verifiedAt: new Date() },
    });

    await prisma.notification.create({
      data: {
        userId: submission.application.userId,
        type: "submission_rejected",
        title: "Submission rejected",
        body: `Your submission for "${submission.gigLabel.labelName}" was not accepted.`,
        metadata: { submissionId: id },
      },
    });
  }

  return NextResponse.json({ success: true, action });
}
