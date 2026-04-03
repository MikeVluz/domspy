import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { isUrlSafe } from "@/lib/security";
import axios from "axios";
import * as cheerio from "cheerio";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};
if (process.env.DOMSPY_CRAWL_KEY) BROWSER_HEADERS["x-domspy-key"] = process.env.DOMSPY_CRAWL_KEY;

export async function POST(req: NextRequest) {
  const { error } = await requireRole("admin");
  if (error) return error;

  try {
    const { pageUrl, domainId } = await req.json();
    if (!pageUrl || !domainId) return NextResponse.json({ error: "pageUrl e domainId obrigatorios" }, { status: 400 });

    // SSRF protection
    const urlCheck = isUrlSafe(pageUrl);
    if (!urlCheck.safe) return NextResponse.json({ error: urlCheck.reason }, { status: 400 });

    const start = Date.now();
    const response = await axios.get(pageUrl, { timeout: 15000, maxRedirects: 3, validateStatus: () => true, headers: BROWSER_HEADERS });
    const responseTime = Date.now() - start;
    const contentType = response.headers["content-type"] || "";

    let title = null, description = null, h1 = null, headings = null, bodyText = null, images = null;

    if (contentType.includes("text/html")) {
      const $ = cheerio.load(response.data as string);
      title = $("title").first().text().trim() || null;
      description = $('meta[name="description"]').attr("content")?.trim() || null;
      h1 = $("h1").first().text().trim() || null;

      const hdgs: { tag: string; text: string }[] = [];
      $("h2, h3, h4").each((_, el) => { const tag = $(el).prop("tagName")?.toLowerCase() || "h2"; const text = $(el).text().trim(); if (text) hdgs.push({ tag, text: text.slice(0, 200) }); });
      headings = hdgs.length > 0 ? JSON.stringify(hdgs) : null;

      const imgs: { src: string; alt: string; format: string }[] = [];
      $("img[src]").each((_, el) => {
        const src = $(el).attr("src") || ""; if (!src || src.startsWith("data:")) return;
        const alt = $(el).attr("alt")?.trim() || "";
        let format = "unknown"; const p = src.split("?")[0].toLowerCase();
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) format = "JPG";
        else if (p.endsWith(".png")) format = "PNG";
        else if (p.endsWith(".webp")) format = "WEBP";
        else if (p.endsWith(".svg")) format = "SVG";
        else if (p.endsWith(".gif")) format = "GIF";
        imgs.push({ src, alt, format });
      });
      images = imgs.length > 0 ? JSON.stringify(imgs) : null;

      $("script, style, noscript").remove();
      const sections: string[] = [];
      const headerText = $("header").first().text().replace(/\s+/g, " ").trim();
      if (headerText) sections.push(`[HEADER]\n${headerText.slice(0, 500)}`);
      const mainEl = $("main").length ? $("main") : $("body");
      const mainText = mainEl.first().text().replace(/\s+/g, " ").trim();
      if (mainText) sections.push(`[CONTEUDO PRINCIPAL]\n${mainText.slice(0, 3000)}`);
      const footerText = $("footer").first().text().replace(/\s+/g, " ").trim();
      if (footerText) sections.push(`[FOOTER]\n${footerText.slice(0, 500)}`);
      bodyText = sections.join("\n\n").slice(0, 5000) || null;

      // Extract links
      const links: { href: string; isExternal: boolean; anchor: string }[] = [];
      const baseHost = new URL(pageUrl).hostname;
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href"); if (!href || /^(javascript:|mailto:|tel:|#)/.test(href)) return;
        try {
          const resolved = new URL(href, pageUrl).toString();
          links.push({ href: resolved, isExternal: new URL(resolved).hostname !== baseHost, anchor: $(el).text().trim().slice(0, 200) });
        } catch {}
      });

      // Update existing page or create
      const existingPage = await prisma.page.findFirst({ where: { url: pageUrl, domainId } });
      if (existingPage) {
        await prisma.page.update({
          where: { id: existingPage.id },
          data: { statusCode: response.status, responseTime, title, description, h1, headings, bodyText, images, updatedAt: new Date() },
        });
        // Update links
        await prisma.link.deleteMany({ where: { fromPageId: existingPage.id } });
        for (const link of links.slice(0, 200)) {
          await prisma.link.create({ data: { fromPageId: existingPage.id, href: link.href, isExternal: link.isExternal, anchor: link.anchor, isRedirect: false } });
        }
      }
    }

    return NextResponse.json({ success: true, statusCode: response.status, responseTime });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao processar pagina" }, { status: 500 });
  }
}
