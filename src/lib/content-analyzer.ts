import { prisma } from "./prisma";

interface ContentIssue {
  pageId: string;
  pageUrl: string;
  type: "missing_title" | "missing_description" | "missing_h1" | "title_h1_mismatch" | "short_description" | "long_description" | "duplicate_content";
  message: string;
  severity: "error" | "warning";
}

export async function analyzeContent(domainId: string): Promise<ContentIssue[]> {
  const pages = await prisma.page.findMany({
    where: { domainId },
  });

  const issues: ContentIssue[] = [];

  // Check for duplicate content via contentHash
  const hashMap = new Map<string, typeof pages>();
  for (const page of pages) {
    if (!page.contentHash) continue;
    const existing = hashMap.get(page.contentHash) || [];
    existing.push(page);
    hashMap.set(page.contentHash, existing);
  }

  for (const page of pages) {
    // Missing title
    if (!page.title) {
      issues.push({
        pageId: page.id,
        pageUrl: page.url,
        type: "missing_title",
        message: "Página sem tag <title>",
        severity: "error",
      });
    }

    // Missing description
    if (!page.description) {
      issues.push({
        pageId: page.id,
        pageUrl: page.url,
        type: "missing_description",
        message: "Página sem meta description",
        severity: "warning",
      });
    }

    // Missing h1
    if (!page.h1) {
      issues.push({
        pageId: page.id,
        pageUrl: page.url,
        type: "missing_h1",
        message: "Página sem tag <h1>",
        severity: "warning",
      });
    }

    // Title vs H1 mismatch
    if (page.title && page.h1 && page.title.toLowerCase() !== page.h1.toLowerCase()) {
      issues.push({
        pageId: page.id,
        pageUrl: page.url,
        type: "title_h1_mismatch",
        message: `Title "${page.title}" difere do H1 "${page.h1}"`,
        severity: "warning",
      });
    }

    // Short description
    if (page.description && page.description.length < 50) {
      issues.push({
        pageId: page.id,
        pageUrl: page.url,
        type: "short_description",
        message: `Meta description muito curta (${page.description.length} caracteres)`,
        severity: "warning",
      });
    }

    // Long description
    if (page.description && page.description.length > 160) {
      issues.push({
        pageId: page.id,
        pageUrl: page.url,
        type: "long_description",
        message: `Meta description muito longa (${page.description.length} caracteres)`,
        severity: "warning",
      });
    }

    // Duplicate content
    if (page.contentHash) {
      const duplicates = hashMap.get(page.contentHash) || [];
      if (duplicates.length > 1) {
        const others = duplicates.filter((d) => d.id !== page.id);
        issues.push({
          pageId: page.id,
          pageUrl: page.url,
          type: "duplicate_content",
          message: `Conteúdo duplicado com: ${others.map((d) => d.url).join(", ")}`,
          severity: "error",
        });
      }
    }
  }

  return issues;
}
