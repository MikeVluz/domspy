"use client";
import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { ArrowLeftIcon, ClockIcon } from "@heroicons/react/24/outline";

interface CrawlData { id: string; status: string; totalPages: number; brokenLinks: number; slowPages: number; startedAt: string; finishedAt: string | null; }

export default function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const [domain, setDomain] = useState<{ name: string; crawls: CrawlData[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      fetch(`/api/domains/${id}`).then((r) => r.json()).then(setDomain).finally(() => setLoading(false));
    }
  }, [status, id]);

  if (loading || !domain) {
    return (<div className="flex min-h-screen"><Sidebar /><main className="flex-1 ml-64 p-8"><div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-48" /></div></main></div>);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <button onClick={() => router.push(`/domains/${id}`)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-[#1a1a2e] mb-2">
            <ArrowLeftIcon className="w-4 h-4" /> Voltar para {domain.name}
          </button>
          <h1 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2">
            <ClockIcon className="w-7 h-7" /> Historico de Crawls
          </h1>
          <p className="text-gray-500 mt-1">{domain.crawls.length} execucoes registradas</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {domain.crawls.map((crawl) => {
              const duration = crawl.finishedAt ? Math.round((new Date(crawl.finishedAt).getTime() - new Date(crawl.startedAt).getTime()) / 1000) : null;
              return (
                <div key={crawl.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${crawl.status === "running" ? "bg-[#3B82F6] animate-pulse" : crawl.status === "completed" ? "bg-[#14A44D]" : crawl.status === "blocked" ? "bg-[#E4A11B]" : "bg-[#DC4C64]"}`} />
                    <div>
                      <div className="font-medium text-[#1a1a2e]">
                        {crawl.status === "running" ? "Em andamento" : crawl.status === "completed" ? "Concluido" : crawl.status === "blocked" ? "Bloqueado (Cloudflare)" : "Falhou"}
                      </div>
                      <div className="text-sm text-gray-400">{new Date(crawl.startedAt).toLocaleString("pt-BR")}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8 text-sm">
                    <div className="text-center"><div className="text-lg font-bold text-[#1a1a2e]">{crawl.totalPages}</div><div className="text-xs text-gray-400">paginas</div></div>
                    <div className="text-center"><div className="text-lg font-bold text-[#DC4C64]">{crawl.brokenLinks}</div><div className="text-xs text-gray-400">quebrados</div></div>
                    <div className="text-center"><div className="text-lg font-bold text-[#E4A11B]">{crawl.slowPages}</div><div className="text-xs text-gray-400">lentos</div></div>
                    {duration !== null && <div className="text-center"><div className="text-lg font-bold text-gray-500">{duration}s</div><div className="text-xs text-gray-400">duracao</div></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
