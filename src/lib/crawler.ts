import axios from "axios";
import * as cheerio from "cheerio";
import { prisma } from "./prisma";

interface CrawlOptions { maxPages?: number; maxDepth?: number; timeout?: number; }

interface PageData { url: string; statusCode: number; responseTime: number; title: string | null; description: string | null; h1: string | null; headings: string | null; bodyText: string | null; images: string | null; links: { href: string; anchor: string; isExternal: boolean }[]; contentHash: string; }

const BROWSER_HEADERS: Record<string, string> = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8", "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7", "Cache-Control": "no-cache", Connection: "keep-alive", "Upgrade-Insecure-Requests": "1" };
if (process.env.DOMSPY_CRAWL_KEY) { BROWSER_HEADERS["x-domspy-key"] = process.env.DOMSPY_CRAWL_KEY; }

function normalizeUrl(base: string, href: string): string | null { try { const url = new URL(href, base); url.hash = ""; let n = url.toString(); if (n.endsWith("/") && n !== url.origin + "/") n = n.slice(0, -1); return n; } catch { return null; } }
function isSameDomain(url: string, baseUrl: string): boolean { try { return new URL(url).hostname === new URL(baseUrl).hostname; } catch { return false; } }
function simpleHash(content: string): string { let hash = 0; for (let i = 0; i < content.length; i++) { hash = (hash << 5) - hash + content.charCodeAt(i); hash |= 0; } return hash.toString(36); }

function parseHtml(html: string, pageUrl: string): Omit<PageData, "statusCode" | "responseTime"> {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || null;
  const description = $('meta[name="description"]').attr("content")?.trim() || null;
  const h1 = $("h1").first().text().trim() || null;

  const links: PageData["links"] = [];
  const seenHrefs = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href"); if (!href || /^(javascript:|mailto:|tel:|#)/.test(href)) return;
    const resolved = normalizeUrl(pageUrl, href); if (!resolved || seenHrefs.has(resolved)) return; seenHrefs.add(resolved);
    links.push({ href: resolved, anchor: $(el).text().trim().slice(0, 200), isExternal: !isSameDomain(resolved, pageUrl) });
  });

  const imagesArr: { src: string; alt: string; format: string }[] = [];
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src") || ""; if (!src || src.startsWith("data:")) return;
    const alt = $(el).attr("alt")?.trim() || "";
    const resolvedSrc = normalizeUrl(pageUrl, src) || src;
    const urlPath = resolvedSrc.split("?")[0].toLowerCase();
    let format = "unknown";
    if (urlPath.endsWith(".jpg") || urlPath.endsWith(".jpeg")) format = "JPG";
    else if (urlPath.endsWith(".png")) format = "PNG";
    else if (urlPath.endsWith(".webp")) format = "WEBP";
    else if (urlPath.endsWith(".svg")) format = "SVG";
    else if (urlPath.endsWith(".gif")) format = "GIF";
    else if (urlPath.endsWith(".avif")) format = "AVIF";
    else if (urlPath.endsWith(".ico")) format = "ICO";
    imagesArr.push({ src: resolvedSrc, alt, format });
  });

  const headingsArr: { tag: string; text: string }[] = [];
  $("h2, h3, h4").each((_, el) => { const tag = $(el).prop("tagName")?.toLowerCase() || "h2"; const text = $(el).text().trim(); if (text) headingsArr.push({ tag, text: text.slice(0, 200) }); });
  const headings = headingsArr.length > 0 ? JSON.stringify(headingsArr) : null;

  $("script, style, noscript").remove();

  // Walk DOM in order to capture text and image positions interleaved
  // This creates a faithful representation of the page structure
  const sectionTags = ["header", "nav", "main", "article", "section", "footer"];

  // If page has semantic sections, use them; otherwise use body
  let hasSemantic = false;
  for (const tag of sectionTags) {
    if ($(tag).length > 0) { hasSemantic = true; break; }
  }

  function walkNode(node: cheerio.AnyNode, output: string[]): void {
    if (node.type === "text") {
      const text = (node as unknown as { data: string }).data || "";
      const clean = text.replace(/\s+/g, " ");
      if (clean.trim()) output.push(clean);
    } else if (node.type === "tag") {
      const el = node as cheerio.Element;
      const tagName = el.tagName?.toLowerCase();

      // Skip hidden elements
      if (["script", "style", "noscript"].includes(tagName)) return;

      // Image marker
      if (tagName === "img") {
        const src = $(el).attr("src") || "";
        if (src && !src.startsWith("data:")) {
          const resolvedSrc = normalizeUrl(pageUrl, src) || src;
          const imgIndex = imagesArr.findIndex((img) => img.src === resolvedSrc);
          if (imgIndex >= 0) {
            output.push(`\n[IMG:${imgIndex}]\n`);
          }
        }
        return;
      }

      // Block elements add line breaks
      const blockTags = ["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "br", "hr", "blockquote", "pre", "figure", "figcaption", "section", "article", "aside", "details", "summary"];
      if (blockTags.includes(tagName)) output.push("\n");

      // Recurse into children
      const children = $(el).contents().toArray();
      for (const child of children) { walkNode(child, output); }

      if (blockTags.includes(tagName)) output.push("\n");
    }
  }

  function extractSection(selector: string, label: string, maxLen: number): string {
    const el = $(selector).first();
    if (el.length === 0) return "";
    const parts: string[] = [];
    walkNode(el.get(0)!, parts);
    const text = parts.join("")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+$/gm, "")
      .trim()
      .slice(0, maxLen);
    return text ? `[${label}]\n${text}` : "";
  }

  const sections: string[] = [];
  if (hasSemantic) {
    const headerSec = extractSection("header", "HEADER", 500);
    if (headerSec) sections.push(headerSec);
    const navSec = extractSection("nav", "NAV", 300);
    if (navSec && navSec !== headerSec) sections.push(navSec);
    const mainSelector = $("main").length ? "main" : $("article").length ? "article" : "body";
    const mainSec = extractSection(mainSelector, "CONTEUDO PRINCIPAL", 3000);
    if (mainSec) sections.push(mainSec);
    const footerSec = extractSection("footer", "FOOTER", 500);
    if (footerSec) sections.push(footerSec);
  } else {
    const bodySec = extractSection("body", "CONTEUDO PRINCIPAL", 4000);
    if (bodySec) sections.push(bodySec);
  }

  const rawBody = sections.join("\n\n");
  const cleanedBody = rawBody
    .replace(/\\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*\n/gm, "")
    .trim();
  const bodyTextTruncated = cleanedBody.slice(0, 5000) || null;

  const rawBodyText = $("body").text().replace(/\\s+/g, " ").trim();
  const contentHash = simpleHash(rawBodyText);
  const images = imagesArr.length > 0 ? JSON.stringify(imagesArr) : null;

  return { url: pageUrl, title, description, h1, headings, bodyText: bodyTextTruncated, images, links, contentHash };
}

async function fetchPage(url: string, timeout: number): Promise<PageData | null> {
  const start = Date.now();
  try {
    const response = await axios.get(url, { timeout, maxRedirects: 5, validateStatus: () => true, headers: BROWSER_HEADERS });
    const responseTime = Date.now() - start;
    const contentType = response.headers["content-type"] || "";
    if (!contentType.includes("text/html")) { return { url, statusCode: response.status, responseTime, title: null, description: null, h1: null, headings: null, bodyText: null, images: null, links: [], contentHash: "" }; }
    const parsed = parseHtml(response.data as string, url);
    return { ...parsed, statusCode: response.status, responseTime };
  } catch (error) {
    const responseTime = Date.now() - start;
    const statusCode = axios.isAxiosError(error) && error.response ? error.response.status : 0;
    return { url, statusCode, responseTime, title: null, description: null, h1: null, headings: null, bodyText: null, images: null, links: [], contentHash: "" };
  }
}

async function fetchSitemapUrls(domainUrl: string): Promise<string[]> {
  const urls: string[] = [];
  const sitemapCandidates: string[] = [];
  try { const robotsUrl = new URL("/robots.txt", domainUrl).toString(); const r = await axios.get(robotsUrl, { timeout: 5000, headers: BROWSER_HEADERS, validateStatus: () => true }); if (r.status === 200 && typeof r.data === "string") { for (const line of r.data.split("\\n")) { const m = line.match(/^Sitemap:\\s*(.+)/i); if (m) sitemapCandidates.push(m[1].trim()); } } } catch {}
  sitemapCandidates.push(new URL("/sitemap.xml", domainUrl).toString(), new URL("/sitemap_index.xml", domainUrl).toString());
  const unique = [...new Set(sitemapCandidates)];
  for (const sitemapUrl of unique) {
    try {
      const res = await axios.get(sitemapUrl, { timeout: 8000, headers: { ...BROWSER_HEADERS, Accept: "application/xml,text/xml,*/*" }, validateStatus: () => true });
      if (res.status !== 200) continue;
      const xml = typeof res.data === "string" ? res.data : "";
      if (!xml.includes("<urlset") && !xml.includes("<sitemapindex")) continue;
      const $ = cheerio.load(xml, { xmlMode: true });
      const childSitemaps: string[] = []; $("sitemap > loc").each((_, el) => { childSitemaps.push($(el).text().trim()); });
      if (childSitemaps.length > 0) { for (const childUrl of childSitemaps.slice(0, 5)) { try { const cr = await axios.get(childUrl, { timeout: 8000, headers: { ...BROWSER_HEADERS, Accept: "application/xml,text/xml,*/*" }, validateStatus: () => true }); if (cr.status === 200) { const $c = cheerio.load(typeof cr.data === "string" ? cr.data : "", { xmlMode: true }); $c("url > loc").each((_, el) => { const loc = $c(el).text().trim(); if (loc) urls.push(loc); }); } } catch {} } }
      $("url > loc").each((_, el) => { const loc = $(el).text().trim(); if (loc) urls.push(loc); });
      if (urls.length > 0) break;
    } catch {}
  }
  return [...new Set(urls)];
}

export async function crawlDomain(domainId: string, domainUrl: string, options: CrawlOptions = {}) {
  const { maxPages = 100, maxDepth = 5, timeout = 10000 } = options;
  const crawlSession = await prisma.crawlSession.create({ data: { domainId, status: "running" } });
  await prisma.page.deleteMany({ where: { domainId } });
  let totalPages = 0, brokenLinks = 0, slowPages = 0;

  console.log("Trying sitemap.xml for:", domainUrl);
  const sitemapUrls = await fetchSitemapUrls(domainUrl);
  console.log(`Found ${sitemapUrls.length} URLs in sitemap`);

  if (sitemapUrls.length > 0) {
    for (const url of sitemapUrls.slice(0, maxPages)) {
      const pd = await fetchPage(url, timeout); if (!pd) continue;
      totalPages++; if (pd.statusCode === 0 || pd.statusCode >= 400) brokenLinks++; if (pd.responseTime > 2000) slowPages++;
      const page = await prisma.page.create({ data: { url: pd.url, domainId, statusCode: pd.statusCode, responseTime: pd.responseTime, title: pd.title, description: pd.description, h1: pd.h1, headings: pd.headings, bodyText: pd.bodyText, images: pd.images, contentHash: pd.contentHash, crawlId: crawlSession.id } });
      for (const link of pd.links) { await prisma.link.create({ data: { fromPageId: page.id, href: link.href, isExternal: link.isExternal, isRedirect: false, anchor: link.anchor } }); }
      await prisma.crawlSession.update({ where: { id: crawlSession.id }, data: { totalPages, brokenLinks, slowPages } });
    }
  } else {
    console.log("No sitemap, using BFS crawl for:", domainUrl);
    const visited = new Set<string>();
    const queue: { url: string; depth: number; parentId: string | null }[] = [];
    const startUrl = normalizeUrl(domainUrl, domainUrl);
    if (!startUrl) { await prisma.crawlSession.update({ where: { id: crawlSession.id }, data: { status: "failed", finishedAt: new Date() } }); return crawlSession.id; }
    queue.push({ url: startUrl, depth: 0, parentId: null }); visited.add(startUrl);

    while (queue.length > 0 && totalPages < maxPages) {
      const { url, depth, parentId } = queue.shift()!;
      const pd = await fetchPage(url, timeout); if (!pd) continue;
      if (totalPages === 0 && pd.statusCode === 403 && pd.title?.includes("Just a moment")) { await prisma.crawlSession.update({ where: { id: crawlSession.id }, data: { status: "blocked", finishedAt: new Date() } }); await prisma.domain.update({ where: { id: domainId }, data: { lastCrawlAt: new Date() } }); return crawlSession.id; }
      totalPages++; if (pd.statusCode === 0 || pd.statusCode >= 400) brokenLinks++; if (pd.responseTime > 2000) slowPages++;
      const page = await prisma.page.create({ data: { url: pd.url, domainId, statusCode: pd.statusCode, responseTime: pd.responseTime, title: pd.title, description: pd.description, h1: pd.h1, headings: pd.headings, bodyText: pd.bodyText, images: pd.images, contentHash: pd.contentHash, parentPageId: parentId, crawlId: crawlSession.id } });
      for (const link of pd.links) {
        await prisma.link.create({ data: { fromPageId: page.id, href: link.href, isExternal: link.isExternal, isRedirect: false, anchor: link.anchor } });
        if (!link.isExternal && !visited.has(link.href) && depth < maxDepth && totalPages + queue.length < maxPages) { visited.add(link.href); queue.push({ url: link.href, depth: depth + 1, parentId: page.id }); }
      }
      await prisma.crawlSession.update({ where: { id: crawlSession.id }, data: { totalPages, brokenLinks, slowPages } });
    }
  }

  await prisma.crawlSession.update({ where: { id: crawlSession.id }, data: { status: "completed", finishedAt: new Date(), totalPages, brokenLinks, slowPages } });
  await prisma.domain.update({ where: { id: domainId }, data: { lastCrawlAt: new Date() } });
  return crawlSession.id;
}
