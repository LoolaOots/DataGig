import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gigId = searchParams.get("gigId");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!gigId) return NextResponse.json({ error: "gigId required" }, { status: 400 });

  // Verify company owns this gig
  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig || gig.companyId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const applications = await prisma.application.findMany({
    where: { gigId },
    include: { user: { include: { userProfile: true } } },
    orderBy: { appliedAt: "desc" },
  });

  return NextResponse.json(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applications.map((a: any) => ({
      id: a.id,
      status: a.status,
      device_type: a.deviceType,
      note_from_user: a.noteFromUser,
      applied_at: a.appliedAt,
      user_profiles: a.user.userProfile
        ? { display_name: a.user.userProfile.displayName, bio: a.user.userProfile.bio }
        : null,
    }))
  );
}

const ApplySchema = z.object({
  gigId: z.string().uuid(),
  deviceType: z.enum(["apple_watch", "generic_android", "generic_ios"]),
  noteFromUser: z.string().max(500).optional(),
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

  if (userRow?.role !== "user") {
    return NextResponse.json({ error: "Only data collectors can apply" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = ApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { gigId, deviceType, noteFromUser } = parsed.data;

  // Check gig is open
  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    include: { deviceRequirements: true },
  });

  if (!gig || gig.status !== "open") {
    return NextResponse.json({ error: "Gig not available" }, { status: 400 });
  }

  if (gig.filledSlots >= gig.totalSlots) {
    return NextResponse.json({ error: "Gig is full" }, { status: 400 });
  }

  // Check device type allowed
  const allowedDevices = (gig.deviceRequirements as { deviceType: string }[]).map((d) => d.deviceType);
  if (!allowedDevices.includes(deviceType)) {
    return NextResponse.json(
      { error: "Device type not accepted for this gig", allowed: allowedDevices },
      { status: 400 }
    );
  }

  // Check not already applied
  const existing = await prisma.application.findUnique({
    where: { gigId_userId: { gigId, userId: user.id } },
  });

  if (existing) {
    return NextResponse.json({ error: "Already applied to this gig" }, { status: 409 });
  }

  const application = await prisma.application.create({
    data: {
      gigId,
      userId: user.id,
      deviceType,
      noteFromUser,
    },
  });

  return NextResponse.json(application, { status: 201 });
}
