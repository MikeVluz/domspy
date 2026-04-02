"use client";
import { getPageStatus, STATUS_COLORS, getStatusErrorMessage } from "@/types";
import { useState } from "react";
import { XMarkIcon, GlobeAltIcon, ClockIcon, DocumentTextIcon, LinkIcon, ExclamationCircleIcon, CheckCircleIcon, EyeSlashIcon, ArrowTopRightOnSquareIcon, PhotoIcon, CodeBracketIcon, ArrowPathIcon, SwatchIcon } from "@heroicons/react/24/outline";

interface PageDetail { id: string; url: string; title: string | null; description: string | null; h1: string | null; headings: string | null; bodyText: string | null; images: string | null; statusCode: number | null; responseTime: number | null; linksFrom: { href: string; statusCode: number | null; isExternal: boolean; anchor: string | null; }[]; groupMembers?: { group: { id: string; name: string; color: string } }[]; }
interface GroupOption { id: string; name: string; color: string; }
interface PageDetailPanelProps { page: PageDetail; onClose: () => void; onDismissAlert?: (pageId: string, alertType: string) => void; dismissedAlerts?: Set<string>; onCrawlPage?: (url: string) => void; groups?: GroupOption[]; onAssignGroup?: (pageId: string, groupId: string) => void; onRemoveFromGroup?: (pageId: string) => void; }

function getTimeCategory(ms: number | null) { if (ms === null) return { label: "N/A", color: "#6B7280" }; if (ms < 900) return { label: "Otimo", color: "#14A44D" }; if (ms < 2000) return { label: "Aceitavel", color: "#E4A11B" }; return { label: "Ruim", color: "#DC4C64" }; }

export default function PageDetailPanel({ page, onClose, onDismissAlert, dismissedAlerts = new Set(), onCrawlPage, groups = [], onAssignGroup, onRemoveFromGroup }: PageDetailPanelProps) {
  const currentGroups = page.groupMembers?.map((m) => m.group) || [];
  const status = getPageStatus(page.statusCode, page.responseTime);
  const colors = STATUS_COLORS[status];
  const timeCat = getTimeCategory(page.responseTime);

  const issues: { type: string; message: string }[] = [];
  if (!page.title) issues.push({ type: "missing_title", message: "Sem tag <title>" });
  if (!page.description) issues.push({ type: "missing_description", message: "Sem meta description" });
  if (!page.h1) issues.push({ type: "missing_h1", message: "Sem tag <h1>" });
  if (page.description && page.description.length < 50) issues.push({ type: "short_description", message: `Description curta (${page.description.length} chars)` });
  if (page.description && page.description.length > 160) issues.push({ type: "long_description", message: `Description longa (${page.description.length} chars)` });
  const visibleIssues = issues.filter((i) => !dismissedAlerts.has(`${page.id}:${i.type}`));
  const internalLinks = page.linksFrom.filter((l) => !l.isExternal);
  const externalLinks = page.linksFrom.filter((l) => l.isExternal);
  const brokenLinks = page.linksFrom.filter((l) => l.statusCode && l.statusCode >= 400);

  return (
    <div className="fixed right-0 top-0 h-screen w-1/2 min-w-[600px] max-w-[900px] bg-white shadow-2xl border-l border-gray-200 z-50 overflow-y-auto">

      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        {/* Row 1: Title + metrics on colored bar */}
        <div className="px-10 py-5" style={{ backgroundColor: colors.bg }}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold break-all" style={{ color: colors.text }}>{page.title || page.url}</h3>
              <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-sm opacity-80 hover:opacity-100 break-all flex items-center gap-1 mt-1" style={{ color: colors.text }}>{page.url} <ArrowTopRightOnSquareIcon className="w-3 h-3 shrink-0" /></a>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/20 shrink-0 ml-4"><XMarkIcon className="w-6 h-6" style={{ color: colors.text }} /></button>
          </div>
          <div className="flex items-center gap-6 mt-3" style={{ color: colors.text }}>
            <span className="text-sm opacity-80">Status: <strong>{page.statusCode === null ? "Pendente" : page.statusCode === 0 ? "ERR" : page.statusCode}</strong></span>
            <span className="text-sm opacity-80"><ClockIcon className="w-3.5 h-3.5 inline" /> <strong>{page.responseTime ? `${page.responseTime}ms` : "N/A"}</strong> {page.responseTime !== null && <span className="opacity-70">({timeCat.label})</span>}</span>
            <span className="text-sm opacity-80"><LinkIcon className="w-3.5 h-3.5 inline" /> <strong>{internalLinks.length}</strong> int / <strong>{externalLinks.length}</strong> ext</span>
            {brokenLinks.length > 0 && <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full"><strong>{brokenLinks.length}</strong> quebrados</span>}
          </div>
          {page.statusCode !== null && page.statusCode !== 200 && <div className="text-xs opacity-70 mt-1" style={{ color: colors.text }}>{getStatusErrorMessage(page.statusCode)}</div>}
        </div>

        {/* Row 2: Action buttons */}
        <div className="px-10 py-3 flex items-center gap-2 flex-wrap bg-gray-50">
          <a href={`/api/download-html?url=${encodeURIComponent(page.url)}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg text-xs font-medium hover:bg-[#3B82F6]/20">
            <CodeBracketIcon className="w-3.5 h-3.5" /> Baixar HTML
          </a>
          {onCrawlPage && (
            <button onClick={() => onCrawlPage(page.url)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14A44D]/10 text-[#14A44D] rounded-lg text-xs font-medium hover:bg-[#14A44D]/20">
              <ArrowPathIcon className="w-3.5 h-3.5" /> Crawl
            </button>
          )}
          {onAssignGroup && (
            <GroupDropdown currentGroups={currentGroups} groups={groups} onAssign={(groupId) => onAssignGroup(page.id, groupId)} onRemove={onRemoveFromGroup ? () => onRemoveFromGroup(page.id) : undefined} />
          )}
          {currentGroups.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              {currentGroups.map((g) => (
                <span key={g.id} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${g.color}20`, color: g.color }}>{g.name}</span>
              ))}
            </div>
          )}
        </div>

        {visibleIssues.length > 0 && (
          <div className="px-10 py-3 bg-[#DC4C64]/5 border-t border-[#DC4C64]/10 flex items-center gap-2 flex-wrap">
            <ExclamationCircleIcon className="w-4 h-4 text-[#DC4C64] shrink-0" />
            {visibleIssues.map((issue) => (
              <span key={issue.type} className="inline-flex items-center gap-1 text-xs text-[#DC4C64] bg-white px-2.5 py-1 rounded-full border border-[#DC4C64]/20">
                {issue.message}
                {onDismissAlert && <button onClick={() => onDismissAlert(page.id, issue.type)} className="hover:bg-[#DC4C64]/10 rounded-full p-0.5"><XMarkIcon className="w-3 h-3" /></button>}
              </span>
            ))}
          </div>
        )}

        {visibleIssues.length === 0 && (
          <div className="px-10 py-3 bg-[#14A44D]/5 border-t border-[#14A44D]/10 flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-[#14A44D]" />
            <span className="text-xs font-medium text-[#14A44D]">Nenhum problema encontrado</span>
          </div>
        )}
      </div>

      <div className="px-10 py-8 space-y-10">

        <div>
          <div className="text-xs text-gray-400 mb-2">Escala de Tempo de Carregamento</div>
          <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden"><div className="h-full flex-1 bg-[#14A44D] rounded-l-full" /><div className="h-full flex-1 bg-[#E4A11B]" /><div className="h-full flex-1 bg-[#DC4C64] rounded-r-full" /></div>
          <div className="flex justify-between text-xs text-gray-400 mt-1.5"><span>0ms</span><span className="text-[#14A44D] font-medium">Otimo (&lt;900ms)</span><span className="text-[#E4A11B] font-medium">Aceitavel (0.9-2s)</span><span className="text-[#DC4C64] font-medium">Ruim (&gt;2s)</span></div>
        </div>

        <div>
          <h4 className="text-base font-semibold text-[#1a1a2e] flex items-center gap-2 mb-5"><DocumentTextIcon className="w-5 h-5" /> Estrutura de Conteudo</h4>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-5"><div className="text-xs text-gray-400 mb-2">Title</div><div className="text-base text-[#1a1a2e] leading-relaxed">{page.title || <span className="text-[#DC4C64]">Nao encontrado</span>}</div></div>
            <div className="bg-gray-50 rounded-xl p-5"><div className="text-xs text-gray-400 mb-2">H1</div><div className="text-base text-[#1a1a2e] leading-relaxed">{page.h1 || <span className="text-[#DC4C64]">Nao encontrado</span>}</div></div>
            <div className="bg-gray-50 rounded-xl p-5"><div className="text-xs text-gray-400 mb-2">Meta Description</div><div className="text-base text-[#1a1a2e] leading-relaxed">{page.description || <span className="text-[#DC4C64]">Nao encontrada</span>}</div></div>
          </div>
        </div>

        {page.headings && (() => { try { const hdgs = JSON.parse(page.headings) as { tag: string; text: string }[]; if (hdgs.length === 0) return null; return (
          <div>
            <h4 className="text-base font-semibold text-[#1a1a2e] flex items-center gap-2 mb-5"><DocumentTextIcon className="w-5 h-5" /> Cabecalhos da Pagina ({hdgs.length})</h4>
            <div className="space-y-2">
              {hdgs.map((h, i) => (
                <div key={i} className="bg-gray-50 rounded-xl px-5 py-3 text-sm text-[#1a1a2e] flex items-start gap-3">
                  <span className={`shrink-0 text-xs font-bold uppercase mt-0.5 ${h.tag === "h2" ? "text-[#3B82F6]" : h.tag === "h3" ? "text-[#8B5CF6]" : "text-[#6B7280]"}`}>{h.tag}</span>
                  <span className={`leading-relaxed ${h.tag === "h3" ? "pl-3" : h.tag === "h4" ? "pl-8" : ""}`}>{h.text}</span>
                </div>
              ))}
            </div>
          </div>
        ); } catch { return null; } })()}

        {page.bodyText && (
          <div>
            <h4 className="text-base font-semibold text-[#1a1a2e] flex items-center gap-2 mb-5"><DocumentTextIcon className="w-5 h-5" /> Texto Completo da Pagina</h4>
            <div className="bg-gray-50 rounded-xl p-6">
              <pre className="text-sm text-[#1a1a2e] whitespace-pre-wrap font-sans leading-loose">{page.bodyText}</pre>
            </div>
          </div>
        )}

        {page.images && (() => { try { const imgs = JSON.parse(page.images) as { src: string; alt: string; format: string }[]; if (imgs.length === 0) return null; return (
          <div>
            <h4 className="text-base font-semibold text-[#1a1a2e] flex items-center gap-2 mb-5"><PhotoIcon className="w-5 h-5" /> Imagens ({imgs.length})</h4>
            <div className="space-y-2">
              {imgs.map((img, i) => { let name = img.src; try { name = new URL(img.src).pathname.split("/").pop() || img.src; } catch {} return (
                <a key={i} href={img.src} target="_blank" rel="noopener noreferrer" className="block bg-gray-50 rounded-xl px-5 py-3 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[#1a1a2e] truncate flex-1">{img.alt || name}</span>
                    <span className={`shrink-0 px-2.5 py-0.5 rounded text-xs font-bold ${img.format === "WEBP" || img.format === "AVIF" ? "bg-[#14A44D]/10 text-[#14A44D]" : img.format === "SVG" ? "bg-[#3B82F6]/10 text-[#3B82F6]" : img.format === "PNG" || img.format === "JPG" ? "bg-[#E4A11B]/10 text-[#E4A11B]" : "bg-gray-100 text-gray-500"}`}>{img.format}</span>
                  </div>
                  <div className="text-xs text-gray-400 truncate mt-1">{img.src}</div>
                </a>
              ); })}
            </div>
          </div>
        ); } catch { return null; } })()}

        <div>
          <h4 className="text-base font-semibold text-[#1a1a2e] flex items-center gap-2 mb-5"><LinkIcon className="w-5 h-5" /> Links Internos ({internalLinks.length})</h4>
          {internalLinks.length > 0 ? (
            <div className="space-y-2">
              {internalLinks.map((link, i) => { const broken = link.statusCode && link.statusCode >= 400; return (
                <a key={i} href={link.href} target="_blank" rel="noopener noreferrer" className={`block px-5 py-3 rounded-xl text-sm break-all hover:opacity-80 flex items-center gap-2 ${broken ? "bg-[#DC4C64]/5 text-[#DC4C64]" : "bg-gray-50 text-[#3B82F6]"}`}>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{link.anchor || link.href}</span>
                  {link.statusCode && <span className="text-gray-400 shrink-0 text-xs">[{link.statusCode}]</span>}
                </a>
              ); })}
            </div>
          ) : <p className="text-sm text-gray-400">Nenhum link interno encontrado</p>}
        </div>

        <div>
          <h4 className="text-base font-semibold text-[#1a1a2e] flex items-center gap-2 mb-5"><ArrowTopRightOnSquareIcon className="w-5 h-5" /> Links Externos ({externalLinks.length})</h4>
          {externalLinks.length > 0 ? (
            <div className="space-y-2">
              {externalLinks.map((link, i) => (
                <a key={i} href={link.href} target="_blank" rel="noopener noreferrer" className="block px-5 py-3 rounded-xl text-sm bg-gray-50 text-[#6B7280] break-all hover:text-[#3B82F6] flex items-center gap-2">
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 shrink-0" />
                  {link.anchor || link.href}
                </a>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">Nenhum link externo encontrado</p>}
        </div>

        {brokenLinks.length > 0 && (
          <div>
            <h4 className="text-base font-semibold text-[#DC4C64] flex items-center gap-2 mb-5"><ExclamationCircleIcon className="w-5 h-5" /> Links Quebrados ({brokenLinks.length})</h4>
            <div className="space-y-2">
              {brokenLinks.map((link, i) => (
                <a key={i} href={link.href} target="_blank" rel="noopener noreferrer" className="block bg-[#DC4C64]/5 px-5 py-3 rounded-xl text-sm text-[#DC4C64] break-all hover:opacity-80">[{link.statusCode}] {link.href}</a>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function GroupDropdown({ currentGroups, groups, onAssign, onRemove }: { currentGroups: GroupOption[]; groups: GroupOption[]; onAssign: (groupId: string) => void; onRemove?: () => void }) {
  const [open, setOpen] = useState(false);
  const currentIds = new Set(currentGroups.map((g) => g.id));

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">
        <SwatchIcon className="w-3.5 h-3.5" />
        {currentGroups.length > 0 ? `${currentGroups.length} grupo(s)` : "Agrupar"}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {groups.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Nenhum grupo criado</div>
          ) : (
            groups.map((g) => (
              <button key={g.id} onClick={() => { onAssign(g.id); setOpen(false); }} className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                {g.name}
                {currentIds.has(g.id) && <span className="ml-auto text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">adicionado</span>}
              </button>
            ))
          )}
          {currentGroups.length > 0 && onRemove && (
            <button onClick={() => { onRemove(); setOpen(false); }} className="w-full px-3 py-2 text-xs text-left text-[#DC4C64] hover:bg-[#DC4C64]/5 border-t border-gray-100">
              Remover de todos os grupos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
