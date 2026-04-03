import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { sanitizeString, validateUrl, safeErrorMessage } from "@/lib/security";

export async function GET() {
  const { error } = await requireRole("viewer");
  if (error) return error;

  try {
    const domains = await prisma.domain.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { pages: true } },
        crawls: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json(domains);
  } catch (error) {
    console.error("List domains error:", error);
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole("admin");
  if (error) return error;

  try {
    const body = await req.json();
    const url = sanitizeString(body.url || "", 2048);
    const name = sanitizeString(body.name || "", 255);

    if (!url || !name) {
      return NextResponse.json({ error: "URL e nome sao obrigatorios" }, { status: 400 });
    }

    const urlCheck = validateUrl(url);
    if (!urlCheck.valid) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 });
    }

    const domain = await prisma.domain.create({
      data: { url, name },
    });

    return NextResponse.json(domain, { status: 201 });
  } catch (error) {
    console.error("Create domain error:", error);
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
