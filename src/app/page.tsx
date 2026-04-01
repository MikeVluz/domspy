"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import StatusCard from "@/components/StatusCard";
import {
  GlobeAltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  SignalIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";

interface DomainData {
  id: string;
  url: string;
  name: string;
  lastCrawlAt: string | null;
  _count: { pages: number };
  crawls: {
    id: string;
    status: string;
    totalPages: number;
    brokenLinks: number;
    slowPages: number;
    startedAt: string;
  }[];
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/domains")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setDomains(data);
        })
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="grid grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-2xl" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const latestCrawls = domains.map((d) => d.crawls[0]).filter(Boolean);
  const totalDomains = domains.length;
  const totalPages = latestCrawls.reduce((sum, c) => sum + c.totalPages, 0);
  const totalBroken = latestCrawls.reduce((sum, c) => sum + c.brokenLinks, 0);
  const totalSlow = latestCrawls.reduce((sum, c) => sum + c.slowPages, 0);
  const totalOk = Math.max(0, totalPages - totalBroken - totalSlow);

  const isAdmin =
    session?.user?.role === "super_admin" || session?.user?.role === "admin";

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1a1a2e]">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Visão geral dos seus domínios monitorados
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatusCard
            title="Domínios"
            value={totalDomains}
            status="info"
            icon={GlobeAltIcon}
          />
          <StatusCard
            title="Páginas OK"
            value={totalOk}
            status="ok"
            icon={CheckCircleIcon}
          />
          <StatusCard
            title="Páginas Lentas"
            value={totalSlow}
            status="warning"
            icon={ExclamationTriangleIcon}
          />
          <StatusCard
            title="Links Quebrados"
            value={totalBroken}
            status="error"
            icon={XCircleIcon}
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-[#1a1a2e]">
              Domínios Monitorados
            </h2>
          </div>

          {domains.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <GlobeAltIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400">
                Nenhum domínio monitorado
              </h3>
              <p className="text-gray-400 mt-1 text-sm">
                {isAdmin
                  ? "Adicione um domínio na página de Domínios para começar"
                  : "Aguarde o administrador adicionar domínios"}
              </p>
              {isAdmin && (
                <button
                  onClick={() => router.push("/domains")}
                  className="mt-4 px-6 py-2 bg-[#3B82F6] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Adicionar Domínio
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {domains.map((domain) => {
                const crawl = domain.crawls[0];
                const hasIssues =
                  crawl && (crawl.brokenLinks > 0 || crawl.slowPages > 0);

                return (
                  <div
                    key={domain.id}
                    className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between"
                    onClick={() => router.push(`/domains/${domain.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          !crawl
                            ? "bg-gray-300"
                            : crawl.status === "running"
                            ? "bg-[#3B82F6] animate-pulse"
                            : hasIssues
                            ? "bg-[#E4A11B]"
                            : "bg-[#14A44D]"
                        }`}
                      />
                      <div>
                        <h3 className="font-medium text-[#1a1a2e]">
                          {domain.name}
                        </h3>
                        <p className="text-sm text-gray-400 flex items-center gap-1">
                          <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                          {domain.url}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      {crawl ? (
                        <>
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <SignalIcon className="w-4 h-4" />
                            {crawl.totalPages} páginas
                          </div>
                          {crawl.brokenLinks > 0 && (
                            <span className="px-2.5 py-1 bg-[#DC4C64]/10 text-[#DC4C64] rounded-lg text-xs font-medium">
                              {crawl.brokenLinks} quebrados
                            </span>
                          )}
                          {crawl.slowPages > 0 && (
                            <span className="px-2.5 py-1 bg-[#E4A11B]/10 text-[#E4A11B] rounded-lg text-xs font-medium">
                              {crawl.slowPages} lentos
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <ClockIcon className="w-3.5 h-3.5" />
                            {new Date(crawl.startedAt).toLocaleDateString(
                              "pt-BR"
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-400">Nunca escaneado</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
