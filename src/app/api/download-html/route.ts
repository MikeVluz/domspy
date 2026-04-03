import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isUrlSafe, sanitizeString } from "@/lib/security";
import axios from "axios";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url e obrigatorio" }, { status: 400 });

  // SSRF protection
  const urlCheck = isUrlSafe(url);
  if (!urlCheck.safe) return NextResponse.json({ error: urlCheck.reason }, { status: 400 });

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 3,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        ...(process.env.DOMSPY_CRAWL_KEY ? { "x-domspy-key": process.env.DOMSPY_CRAWL_KEY } : {}),
      },
      validateStatus: () => true,
    });

    const html = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
    const filename = sanitizeString(new URL(url).pathname.replace(/\//g, "_").replace(/^_/, "") || "index", 100);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.html"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao baixar pagina" }, { status: 500 });
  }
}
