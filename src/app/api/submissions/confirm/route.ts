import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

const ConfirmSchema = z.object({
  applicationId: z.string().uuid(),
  gigLabelId: z.string().uuid(),
  assignmentCode: z.string().min(1),
  storagePath: z.string().min(1),
  fileSizeBytes: z.number().int().optional(),
  durationSeconds: z.number().int().optional(),
  deviceType: z.enum(["apple_watch", "generic_android", "generic_ios"]),
  deviceMetadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Verify ownership
  const application = await prisma.application.findUnique({
    where: { id: data.applicationId },
  });

  if (!application || application.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (application.assignmentCode !== data.assignmentCode) {
    return NextResponse.json({ error: "Invalid assignment code" }, { status: 400 });
  }

  const submission = await prisma.submission.create({
    data: {
      applicationId: data.applicationId,
      gigLabelId: data.gigLabelId,
      assignmentCode: data.assignmentCode,
      storagePath: data.storagePath,
      fileSizeBytes: data.fileSizeBytes ? BigInt(data.fileSizeBytes) : null,
      durationSeconds: data.durationSeconds,
      deviceType: data.deviceType,
      deviceMetadata: (data.deviceMetadata ?? {}) as Record<string, string | number | boolean | null>,
    },
  });

  // Enqueue verification job
  await inngest.send({
    name: "submission/verify",
    data: { submissionId: submission.id },
  });

  return NextResponse.json({ submissionId: submission.id }, { status: 201 });
}
