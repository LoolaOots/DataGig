import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const CreateGigSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  activityType: z.string().min(1),
  totalSlots: z.number().int().min(1).max(1000),
  applicationDeadline: z.string().datetime().optional(),
  dataDeadline: z.string().datetime().optional(),
  labels: z.array(
    z.object({
      labelName: z.string().min(1),
      description: z.string().optional(),
      durationSeconds: z.number().int().min(1),
      rateCents: z.number().int().min(1),
      quantityNeeded: z.number().int().min(1),
    })
  ).min(1),
  deviceTypes: z.array(z.enum(["apple_watch", "generic_android", "generic_ios"])).min(1),
});

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

  const body = await request.json();
  const parsed = CreateGigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { labels, deviceTypes, ...gigData } = parsed.data;

  const gig = await prisma.gig.create({
    data: {
      companyId: user.id,
      title: gigData.title,
      description: gigData.description,
      activityType: gigData.activityType,
      totalSlots: gigData.totalSlots,
      applicationDeadline: gigData.applicationDeadline
        ? new Date(gigData.applicationDeadline)
        : null,
      dataDeadline: gigData.dataDeadline ? new Date(gigData.dataDeadline) : null,
      labels: {
        create: labels.map((l) => ({
          labelName: l.labelName,
          description: l.description,
          durationSeconds: l.durationSeconds,
          rateCents: l.rateCents,
          quantityNeeded: l.quantityNeeded,
        })),
      },
      deviceRequirements: {
        create: deviceTypes.map((dt) => ({ deviceType: dt })),
      },
    },
    include: { labels: true, deviceRequirements: true },
  });

  return NextResponse.json(gig, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  const gigs = await prisma.gig.findMany({
    where: { status: "open" },
    include: {
      labels: { select: { rateCents: true } },
      deviceRequirements: true,
      company: { select: { companyName: true } },
    },
    orderBy: { publishedAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json(gigs);
}
