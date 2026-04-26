import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { zipSync } from "fflate";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function getUtcDateString(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(req: NextRequest) {
  // Auth: verify user is logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Auth: verify user has "company" role
  let dbUser: { role: string } | null = null;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!dbUser || dbUser.role !== "company") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("submissionIds" in body) ||
    !Array.isArray((body as { submissionIds: unknown }).submissionIds)
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { submissionIds } = body as { submissionIds: unknown[] };

  if (submissionIds.length > 100) {
    return NextResponse.json(
      { error: "Select 100 or fewer files to download at once" },
      { status: 400 }
    );
  }

  if (submissionIds.length === 0) {
    return NextResponse.json({ error: "No submissions selected" }, { status: 400 });
  }

  // Validate each ID is a UUID
  for (const id of submissionIds) {
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "Invalid submissionId format" },
        { status: 400 }
      );
    }
  }

  const validSubmissionIds = submissionIds as string[];

  // Fetch submissions with ownership verification
  let submissions: {
    id: string;
    storagePath: string | null;
    application: {
      gig: {
        title: string;
      };
    };
  }[];

  try {
    submissions = await prisma.submission.findMany({
      where: {
        id: { in: validSubmissionIds },
        storagePath: { not: null },
        application: {
          gig: { companyId: user.id },
        },
      },
      select: {
        id: true,
        storagePath: true,
        application: {
          select: {
            gig: {
              select: { title: true },
            },
          },
        },
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Verify all requested IDs were found with valid ownership
  if (submissions.length !== validSubmissionIds.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate signed URLs for all files concurrently (60s is enough for zip building)
  const adminClient = createAdminClient();
  const signedUrlResults = await Promise.all(
    submissions.map((submission) =>
      adminClient.storage.from("sensor-data").createSignedUrl(submission.storagePath!, 60)
    )
  );

  for (const { error } of signedUrlResults) {
    if (error) {
      return NextResponse.json(
        { error: "Download failed — please try again" },
        { status: 500 }
      );
    }
  }

  // Fetch file bytes via signed URLs concurrently (bypasses storage RLS)
  let fetchResults: Response[];
  try {
    fetchResults = await Promise.all(
      signedUrlResults.map(({ data }) => fetch(data!.signedUrl))
    );
  } catch {
    return NextResponse.json(
      { error: "Download failed — please try again" },
      { status: 500 }
    );
  }

  for (const res of fetchResults) {
    if (!res.ok) {
      return NextResponse.json(
        { error: "Download failed — please try again" },
        { status: 500 }
      );
    }
  }

  // Convert responses to Uint8Arrays and build the files map with deduplication
  const files: Record<string, Uint8Array> = {};
  const filenameCounts: Record<string, number> = {};

  for (let i = 0; i < submissions.length; i++) {
    const submission = submissions[i];

    const storagePath = submission.storagePath;
    if (!storagePath) continue; // defensive; Prisma filter should prevent this

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await fetchResults[i].arrayBuffer();
    } catch {
      return NextResponse.json(
        { error: "Download failed — please try again" },
        { status: 500 }
      );
    }
    const uint8 = new Uint8Array(arrayBuffer);

    // Use last segment of storagePath as filename, with deduplication
    const segments = storagePath.split("/");
    const baseFilename = segments[segments.length - 1];

    if (!(baseFilename in filenameCounts)) {
      filenameCounts[baseFilename] = 0;
      files[baseFilename] = uint8;
    } else {
      filenameCounts[baseFilename] += 1;
      const count = filenameCounts[baseFilename];
      const dotIndex = baseFilename.lastIndexOf(".");
      let dedupedFilename: string;
      if (dotIndex !== -1) {
        dedupedFilename =
          baseFilename.slice(0, dotIndex) +
          `_${count}` +
          baseFilename.slice(dotIndex);
      } else {
        dedupedFilename = `${baseFilename}_${count}`;
      }
      files[dedupedFilename] = uint8;
    }
  }

  // Build zip in memory
  const zipBuffer = zipSync(files);
  const zipArrayBuffer: ArrayBuffer = zipBuffer.buffer instanceof ArrayBuffer
    ? zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength)
    : new Uint8Array(zipBuffer).buffer;

  // Build filename from first submission's gig title
  const firstGigTitle = submissions[0].application.gig.title;
  const slugifiedTitle = slugify(firstGigTitle);
  const dateStr = getUtcDateString();
  const zipFilename = `recordings-${slugifiedTitle}-${dateStr}.zip`;

  return new Response(zipArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
    },
  });
}
