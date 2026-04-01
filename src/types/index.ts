export type PageStatus = "ok" | "warning" | "error" | "info";

export interface SiteNode {
  id: string;
  url: string;
  title: string | null;
  statusCode: number | null;
  responseTime: number | null;
  status: PageStatus;
  parentId: string | null;
  childCount: number;
}

export interface CrawlResult {
  totalPages: number;
  brokenLinks: number;
  slowPages: number;
  okPages: number;
  warnings: number;
}

export function getPageStatus(
  statusCode: number | null,
  responseTime: number | null
): PageStatus {
  if (statusCode === null || statusCode === undefined) return "info"; // Pending
  if (statusCode === 0 || statusCode >= 400) return "error";
  if (statusCode >= 300 || (responseTime && responseTime > 3000))
    return "warning";
  if (responseTime && responseTime > 1000) return "info";
  return "ok";
}

export const STATUS_COLORS = {
  error: { bg: "#DC4C64", text: "#FFFFFF", label: "Erro" },
  warning: { bg: "#E4A11B", text: "#FFFFFF", label: "Aviso" },
  info: { bg: "#3B82F6", text: "#FFFFFF", label: "Normal" },
  ok: { bg: "#14A44D", text: "#FFFFFF", label: "OK" },
} as const;
