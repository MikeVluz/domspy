export type PageStatus = "ok" | "warning" | "error" | "info";

export interface SiteNode {
  id: string; url: string; title: string | null; statusCode: number | null;
  responseTime: number | null; status: PageStatus; parentId: string | null; childCount: number;
}

export interface CrawlResult {
  totalPages: number; brokenLinks: number; slowPages: number; okPages: number; warnings: number;
}

export function getPageStatus(statusCode: number | null, responseTime: number | null): PageStatus {
  if (statusCode === null || statusCode === undefined) return "info"; // Pendente
  if (statusCode === 0 || statusCode >= 400) return "error";         // Erro
  if (statusCode >= 300) return "warning";                            // Redirecionamento
  if (responseTime && responseTime > 2000) return "error";           // Ruim (>2s)
  if (responseTime && responseTime > 900) return "warning";          // Aceitavel (900ms-2s)
  return "ok";                                                        // Otimo (<900ms)
}

export function getStatusErrorMessage(statusCode: number | null): string {
  if (statusCode === null) return "Pendente - aguardando verificacao";
  if (statusCode === 0) return "Erro de conexao - o servidor nao respondeu. Verifique se a URL esta correta.";
  if (statusCode === 403) return "Erro 403: O servidor recusou a conexao como medida de seguranca. Verifique as configuracoes do Cloudflare ou contate o administrador do dominio.";
  if (statusCode === 404) return "Erro 404: Pagina nao encontrada. A URL pode ter sido removida ou alterada.";
  if (statusCode === 500) return "Erro 500: Erro interno do servidor. O site pode estar com problemas temporarios.";
  if (statusCode === 502) return "Erro 502: Gateway invalido. O servidor intermediario nao conseguiu processar a requisicao.";
  if (statusCode === 503) return "Erro 503: Servico indisponivel. O site pode estar em manutencao.";
  if (statusCode === 504) return "Erro 504: Tempo de resposta esgotado. O servidor demorou demais para responder.";
  if (statusCode >= 400 && statusCode < 500) return `Erro ${statusCode}: Requisicao rejeitada pelo servidor.`;
  if (statusCode >= 500) return `Erro ${statusCode}: Problema no servidor de destino.`;
  if (statusCode >= 300 && statusCode < 400) return `Redirecionamento ${statusCode}: A pagina foi movida para outro endereco.`;
  return `Status ${statusCode}`;
}

export function getStatusLabel(statusCode: number | null): string {
  if (statusCode === null) return "Pendente";
  if (statusCode === 0) return "Sem resposta";
  if (statusCode === 200) return "200: OK";
  if (statusCode === 301) return "301: Redirecionado";
  if (statusCode === 302) return "302: Redirecionado";
  if (statusCode === 403) return "403: Bloqueado";
  if (statusCode === 404) return "404: Nao encontrada";
  if (statusCode === 500) return "500: Erro servidor";
  if (statusCode === 502) return "502: Gateway erro";
  if (statusCode === 503) return "503: Indisponivel";
  if (statusCode === 504) return "504: Timeout";
  if (statusCode >= 200 && statusCode < 300) return `${statusCode}: OK`;
  if (statusCode >= 300 && statusCode < 400) return `${statusCode}: Redireciona`;
  if (statusCode >= 400 && statusCode < 500) return `${statusCode}: Erro cliente`;
  if (statusCode >= 500) return `${statusCode}: Erro servidor`;
  return `${statusCode}`;
}

export const STATUS_COLORS = {
  error: { bg: "#DC4C64", text: "#FFFFFF", label: "Erro" },
  warning: { bg: "#E4A11B", text: "#FFFFFF", label: "Aviso" },
  info: { bg: "#3B82F6", text: "#FFFFFF", label: "Normal" },
  ok: { bg: "#14A44D", text: "#FFFFFF", label: "OK" },
} as const;
