import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const gig = await prisma.gig.findUnique({
    where: { id },
    include: {
      labels: true,
      deviceRequirements: true,
      company: { select: { companyName: true } },
    },
  });

  if (!gig) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(gig);
}
