import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { crawlDomain } from "@/lib/crawler";
import { requireRole } from "@/lib/auth-helpers";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { error } = await requireRole("admin");
  if (error) return error;

  try {
    const body = await req.json();
    const { domainId } = body;

    if (!domainId) {
      return NextResponse.json(
        { error: "domainId e obrigatorio" },
        { status: 400 }
      );
    }

    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });
    if (!domain) {
      return NextResponse.json(
        { error: "Dominio nao encontrado" },
        { status: 404 }
      );
    }

    const runningCrawl = await prisma.crawlSession.findFirst({
      where: { domainId, status: "running" },
    });

    if (runningCrawl) {
      return NextResponse.json(
        { error: "Ja existe um crawl em andamento para este dominio" },
        { status: 409 }
      );
    }

    try {
      const crawlId = await crawlDomain(domainId, domain.url);
      return NextResponse.json({
        message: "Crawl concluido",
        crawlId,
        domainId,
      });
    } catch (crawlError) {
      console.error("Crawl failed:", crawlError);
      await prisma.crawlSession.updateMany({
        where: { domainId, status: "running" },
        data: { status: "failed", finishedAt: new Date() },
      });
      return NextResponse.json({ error: "Crawl falhou" }, { status: 500 });
    }
  } catch (error) {
    console.error("Crawl API error:", error);
    return NextResponse.json({ error: "Erro ao iniciar crawl" }, { status: 500 });
  }
}
