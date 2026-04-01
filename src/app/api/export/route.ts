import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPageStatus } from "@/types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const domainId = req.nextUrl.searchParams.get("domainId");
  if (!domainId) {
    return NextResponse.json({ error: "domainId e obrigatorio" }, { status: 400 });
  }

  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    include: {
      pages: {
        orderBy: { url: "asc" },
        include: { linksFrom: true },
      },
    },
  });

  if (!domain) {
    return NextResponse.json({ error: "Dominio nao encontrado" }, { status: 404 });
  }

  let md = `# ${domain.name}\n\n`;
  md += `**URL:** ${domain.url}\n`;
  md += `**Ultimo crawl:** ${domain.lastCrawlAt?.toLocaleString("pt-BR") || "Nunca"}\n`;
  md += `**Total de paginas:** ${domain.pages.length}\n\n`;
  md += `---\n\n`;
  md += `## Arvore de Paginas\n\n`;

  type DomainPage = (typeof domain.pages)[number];
  const rootPages = domain.pages.filter((p) => !p.parentPageId);
  const childrenMap = new Map<string, DomainPage[]>();

  for (const page of domain.pages) {
    if (page.parentPageId) {
      const children = childrenMap.get(page.parentPageId) || [];
      children.push(page);
      childrenMap.set(page.parentPageId, children);
    }
  }

  function renderPage(page: DomainPage, indent: number) {
    const status = getPageStatus(page.statusCode, page.responseTime);
    const statusEmoji = status === "ok" ? "+" : status === "warning" ? "!" : status === "error" ? "x" : "-";
    const prefix = "  ".repeat(indent);
    md += `${prefix}- [${statusEmoji}] **${page.title || page.url}**\n`;
    md += `${prefix}  - URL: ${page.url}\n`;
    md += `${prefix}  - Status: ${page.statusCode || "N/A"} | Tempo: ${page.responseTime || "N/A"}ms\n`;
    if (page.description) md += `${prefix}  - Descricao: ${page.description}\n`;
    const children = childrenMap.get(page.id) || [];
    for (const child of children) renderPage(child, indent + 1);
  }

  for (const page of rootPages) renderPage(page, 0);

  md += `\n---\n*Exportado por DomSpy em ${new Date().toLocaleString("pt-BR")}*\n`;

  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${domain.name}-sitemap.md"`,
    },
  });
}
