import axios from "axios";
import * as cheerio from "cheerio";
import { prisma } from "./prisma";

interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  timeout?: number;
}

interface PageData {
  url: string;
  statusCode: number;
  responseTime: number;
  title: string | null;
  description: string | null;
  h1: string | null;
  links: { href: string; anchor: string; isExternal: boolean }[];
  contentHash: string;
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

// Add secret header for Cloudflare bypass if configured
if (process.env.DOMSPY_CRAWL_KEY) {
  BROWSER_HEADERS["x-domspy-key"] = process.env.DOMSPY_CRAWL_KEY;
}

function normalizeUrl(base: string, href: string): string | null {
  try {
    const url = new URL(href, base);
    url.hash = "";
    let normalized = url.toString();
    if (normalized.endsWith("/") && normalized !== url.origin + "/") {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return null;
  }
}

function isSameDomain(url: string, baseUrl: string): boolean {
  try {
    const a = new URL(url);
    const b = new URL(baseUrl);
    return a.hostname === b.hostname;
  } catch {
    return false;
  }
}

function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function parseHtml(
  html: string,
  pageUrl: string
): Omit<PageData, "statusCode" | "responseTime"> {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || null;
  const description =
    $('meta[name="description"]').attr("content")?.trim() || null;
  const h1 = $("h1").first().text().trim() || null;

  const links: PageData["links"] = [];
  const seenHrefs = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (/^(javascript:|mailto:|tel:|#)/.test(href)) return;

    const resolved = normalizeUrl(pageUrl, href);
    if (!resolved || seenHrefs.has(resolved)) return;
    seenHrefs.add(resolved);

    links.push({
      href: resolved,
      anchor: $(el).text().trim().slice(0, 200),
      isExternal: !isSameDomain(resolved, pageUrl),
    });
  });

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const contentHash = simpleHash(bodyText);

  return { url: pageUrl, title, description, h1, links, contentHash };
}

// Fetch a single page with Axios
async function fetchPage(
  url: string,
  timeout: number
): Promise<PageData | null> {
  const start = Date.now();

  try {
    const response = await axios.get(url, {
      timeout,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: BROWSER_HEADERS,
    });

    const responseTime = Date.now() - start;
    const contentType = response.headers["content-type"] || "";

    if (!contentType.includes("text/html")) {
      return {
        url,
        statusCode: response.status,
        responseTime,
        title: null,
        description: null,
        h1: null,
        links: [],
        contentHash: "",
      };
    }

    const html = response.data as string;
    const parsed = parseHtml(html, url);

    return { ...parsed, statusCode: response.status, responseTime };
  } catch (error) {
    const responseTime = Date.now() - start;
    const statusCode =
      axios.isAxiosError(error) && error.response
        ? error.response.status
        : 0;

    return {
      url,
      statusCode,
      responseTime,
      title: null,
      description: null,
      h1: null,
      links: [],
      contentHash: "",
    };
  }
}

// Try to fetch sitemap.xml and extract URLs
async function fetchSitemapUrls(domainUrl: string): Promise<string[]> {
  const urls: string[] = [];
  const sitemapCandidates: string[] = [];

  // Try robots.txt first to find sitemap location
  try {
    const robotsUrl = new URL("/robots.txt", domainUrl).toString();
    const robotsRes = await axios.get(robotsUrl, {
      timeout: 5000,
      headers: BROWSER_HEADERS,
      validateStatus: () => true,
    });

    if (robotsRes.status === 200 && typeof robotsRes.data === "string") {
      const lines = robotsRes.data.split("\n");
      for (const line of lines) {
        const match = line.match(/^Sitemap:\s*(.+)/i);
        if (match) {
          sitemapCandidates.push(match[1].trim());
        }
      }
    }
  } catch {
    // Ignore robots.txt errors
  }

  // Add default sitemap locations
  sitemapCandidates.push(
    new URL("/sitemap.xml", domainUrl).toString(),
    new URL("/sitemap_index.xml", domainUrl).toString()
  );

  // Remove duplicates
  const uniqueSitemaps = [...new Set(sitemapCandidates)];

  for (const sitemapUrl of uniqueSitemaps) {
    try {
      const res = await axios.get(sitemapUrl, {
        timeout: 8000,
        headers: {
          ...BROWSER_HEADERS,
          Accept: "application/xml,text/xml,*/*",
        },
        validateStatus: () => true,
      });

      if (res.status !== 200) continue;

      const xml = typeof res.data === "string" ? res.data : "";
      if (!xml.includes("<urlset") && !xml.includes("<sitemapindex")) continue;

      const $ = cheerio.load(xml, { xmlMode: true });

      // Check if it's a sitemap index (contains other sitemaps)
      const childSitemaps: string[] = [];
      $("sitemap > loc").each((_, el) => {
        childSitemaps.push($(el).text().trim());
      });

      if (childSitemaps.length > 0) {
        // Fetch child sitemaps (limit to first 5)
        for (const childUrl of childSitemaps.slice(0, 5)) {
          try {
            const childRes = await axios.get(childUrl, {
              timeout: 8000,
              headers: {
                ...BROWSER_HEADERS,
                Accept: "application/xml,text/xml,*/*",
              },
              validateStatus: () => true,
            });

            if (childRes.status === 200) {
              const childXml =
                typeof childRes.data === "string" ? childRes.data : "";
              const $child = cheerio.load(childXml, { xmlMode: true });
              $child("url > loc").each((_, el) => {
                const loc = $child(el).text().trim();
                if (loc) urls.push(loc);
              });
            }
          } catch {
            // Skip failed child sitemaps
          }
        }
      }

      // Regular sitemap with URLs
      $("url > loc").each((_, el) => {
        const loc = $(el).text().trim();
        if (loc) urls.push(loc);
      });

      if (urls.length > 0) break; // Found URLs, stop trying other sitemaps
    } catch {
      // Try next sitemap candidate
    }
  }

  return [...new Set(urls)]; // Remove duplicates
}

export async function crawlDomain(
  domainId: string,
  domainUrl: string,
  options: CrawlOptions = {}
) {
  const { maxPages = 100, maxDepth = 5, timeout = 10000 } = options;

  const crawlSession = await prisma.crawlSession.create({
    data: { domainId, status: "running" },
  });

  // Delete old pages for this domain
  await prisma.page.deleteMany({ where: { domainId } });

  let totalPages = 0;
  let brokenLinks = 0;
  let slowPages = 0;

  // Strategy 1: Try sitemap.xml first
  console.log("Trying sitemap.xml for:", domainUrl);
  const sitemapUrls = await fetchSitemapUrls(domainUrl);
  console.log(`Found ${sitemapUrls.length} URLs in sitemap`);

  if (sitemapUrls.length > 0) {
    const urlsToCheck = sitemapUrls.slice(0, maxPages);

    for (const url of urlsToCheck) {
      const pageData = await fetchPage(url, timeout);
      if (!pageData) continue;

      totalPages++;
      if (pageData.statusCode === 0 || pageData.statusCode >= 400) brokenLinks++;
      if (pageData.responseTime > 3000) slowPages++;

      const page = await prisma.page.create({
        data: {
          url: pageData.url,
          domainId,
          statusCode: pageData.statusCode,
          responseTime: pageData.responseTime,
          title: pageData.title,
          description: pageData.description,
          h1: pageData.h1,
          contentHash: pageData.contentHash,
          crawlId: crawlSession.id,
        },
      });

      for (const link of pageData.links) {
        await prisma.link.create({
          data: {
            fromPageId: page.id,
            href: link.href,
            isExternal: link.isExternal,
            isRedirect: false,
            anchor: link.anchor,
          },
        });
      }

      await prisma.crawlSession.update({
        where: { id: crawlSession.id },
        data: { totalPages, brokenLinks, slowPages },
      });
    }
  } else {
    // Strategy 2: BFS crawl
    console.log("No sitemap found, using BFS crawl for:", domainUrl);

    const visited = new Set<string>();
    const queue: { url: string; depth: number; parentId: string | null }[] = [];

    const startUrl = normalizeUrl(domainUrl, domainUrl);
    if (!startUrl) {
      await prisma.crawlSession.update({
        where: { id: crawlSession.id },
        data: { status: "failed", finishedAt: new Date() },
      });
      return crawlSession.id;
    }

    queue.push({ url: startUrl, depth: 0, parentId: null });
    visited.add(startUrl);

    while (queue.length > 0 && totalPages < maxPages) {
      const item = queue.shift()!;
      const { url, depth, parentId } = item;

      const pageData = await fetchPage(url, timeout);
      if (!pageData) continue;

      // Detect Cloudflare on first page
      if (
        totalPages === 0 &&
        pageData.statusCode === 403 &&
        pageData.title?.includes("Just a moment")
      ) {
        await prisma.crawlSession.update({
          where: { id: crawlSession.id },
          data: { status: "blocked", finishedAt: new Date() },
        });
        await prisma.domain.update({
          where: { id: domainId },
          data: { lastCrawlAt: new Date() },
        });
        return crawlSession.id;
      }

      totalPages++;
      if (pageData.statusCode === 0 || pageData.statusCode >= 400) brokenLinks++;
      if (pageData.responseTime > 3000) slowPages++;

      const page = await prisma.page.create({
        data: {
          url: pageData.url,
          domainId,
          statusCode: pageData.statusCode,
          responseTime: pageData.responseTime,
          title: pageData.title,
          description: pageData.description,
          h1: pageData.h1,
          contentHash: pageData.contentHash,
          parentPageId: parentId,
          crawlId: crawlSession.id,
        },
      });

      for (const link of pageData.links) {
        await prisma.link.create({
          data: {
            fromPageId: page.id,
            href: link.href,
            isExternal: link.isExternal,
            isRedirect: false,
            anchor: link.anchor,
          },
        });

        if (
          !link.isExternal &&
          !visited.has(link.href) &&
          depth < maxDepth &&
          totalPages + queue.length < maxPages
        ) {
          visited.add(link.href);
          queue.push({ url: link.href, depth: depth + 1, parentId: page.id });
        }
      }

      await prisma.crawlSession.update({
        where: { id: crawlSession.id },
        data: { totalPages, brokenLinks, slowPages },
      });
    }
  }

  await prisma.crawlSession.update({
    where: { id: crawlSession.id },
    data: {
      status: "completed",
      finishedAt: new Date(),
      totalPages,
      brokenLinks,
      slowPages,
    },
  });

  await prisma.domain.update({
    where: { id: domainId },
    data: { lastCrawlAt: new Date() },
  });

  return crawlSession.id;
}
