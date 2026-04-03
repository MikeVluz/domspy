import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireRole("viewer");
  if (error) return error;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const exact = url.searchParams.get("exact") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

  if (!q || q.length < 2 || q.length > 200) return NextResponse.json({ domains: [], pages: [] });

  const mode = exact ? ("default" as const) : ("insensitive" as const);
  const contains = exact ? q : q;

  const [domains, pages] = await Promise.all([
    prisma.domain.findMany({
      where: {
        OR: [
          { name: { contains, mode } },
          { url: { contains, mode } },
        ],
      },
      include: { _count: { select: { pages: true } }, crawls: { orderBy: { startedAt: "desc" as const }, take: 1 } },
      take: limit,
    }),
    prisma.page.findMany({
      where: {
        OR: [
          { url: { contains, mode } },
          { title: { contains, mode } },
          { bodyText: { contains, mode } },
          { h1: { contains, mode } },
          { description: { contains, mode } },
        ],
      },
      select: {
        id: true, url: true, title: true, statusCode: true, responseTime: true,
        domainId: true, domain: { select: { name: true } },
      },
      take: limit,
    }),
  ]);

  return NextResponse.json({ domains, pages });
}
