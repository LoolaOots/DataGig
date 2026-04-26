import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fix 3: Verify the authenticated user has the "company" role
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (!dbUser || dbUser.role !== "company") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submissionId = req.nextUrl.searchParams.get("submissionId");
  if (!submissionId) {
    return NextResponse.json(
      { error: "Missing submissionId" },
      { status: 400 }
    );
  }

  // Fix 1: Validate UUID format before passing to Prisma
  if (!UUID_RE.test(submissionId)) {
    return NextResponse.json(
      { error: "Invalid submissionId" },
      { status: 400 }
    );
  }

  // Fix 2: Wrap Prisma + Supabase calls in try/catch
  try {
    const submission = await prisma.submission.findFirst({
      where: {
        id: submissionId,
        application: {
          gig: {
            companyId: user.id,
          },
        },
      },
      select: {
        storagePath: true,
      },
    });

    if (!submission || !submission.storagePath) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase.storage
      .from("sensor-data")
      .createSignedUrl(submission.storagePath, 60);

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to generate signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
