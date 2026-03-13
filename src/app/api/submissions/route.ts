import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const SubmissionInitSchema = z.object({
  assignmentCode: z.string().min(1),
  gigLabelId: z.string().uuid(),
  deviceType: z.enum(["apple_watch", "generic_android", "generic_ios"]),
  fileExtension: z.string().default("csv"),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = SubmissionInitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { assignmentCode, gigLabelId, deviceType, fileExtension } = parsed.data;

  // Validate assignment code belongs to this user
  const { data: application } = await supabase
    .from("applications")
    .select("id, gig_id, status")
    .eq("assignment_code", assignmentCode)
    .eq("user_id", user.id)
    .single();

  if (!application || application.status !== "accepted") {
    return NextResponse.json(
      { error: "Invalid assignment code or application not accepted" },
      { status: 400 }
    );
  }

  // Generate upload path
  const storagePath = `submissions/${user.id}/${application.id}/${gigLabelId}/${Date.now()}.${fileExtension}`;

  // Create signed upload URL (expires in 10 minutes)
  const { data: signedUrl, error } = await supabase.storage
    .from("sensor-data")
    .createSignedUploadUrl(storagePath);

  if (error) {
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: signedUrl.signedUrl,
    token: signedUrl.token,
    storagePath,
    applicationId: application.id,
  });
}
