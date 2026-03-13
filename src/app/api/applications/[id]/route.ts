import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

const ReviewSchema = z.object({
  action: z.enum(["accept", "deny"]),
  noteFromCompany: z.string().max(500).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { action, noteFromCompany } = parsed.data;

  const application = await prisma.application.findUnique({
    where: { id },
    include: { gig: true },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (application.gig.companyId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (application.status !== "pending") {
    return NextResponse.json({ error: "Application already reviewed" }, { status: 400 });
  }

  const newStatus = action === "accept" ? "accepted" : "denied";

  await prisma.application.update({
    where: { id },
    data: { status: newStatus, noteFromCompany },
  });

  if (action === "accept") {
    // Increment filled slots
    await prisma.gig.update({
      where: { id: application.gigId },
      data: { filledSlots: { increment: 1 } },
    });

    await inngest.send({
      name: "application/accepted",
      data: { applicationId: id },
    });
  } else {
    await inngest.send({
      name: "application/denied",
      data: { applicationId: id },
    });
  }

  return NextResponse.json({ success: true, status: newStatus });
}
