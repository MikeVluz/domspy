import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, validateEmail, validatePassword, sanitizeString, safeErrorMessage } from "@/lib/security";

export async function POST(req: NextRequest) {
  // Rate limit: 5 registrations per IP per 15 minutes
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const limit = checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${Math.ceil(limit.resetIn / 1000)}s` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.resetIn / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const email = sanitizeString(body.email || "", 320).toLowerCase();
    const password = body.password || "";
    const name = sanitizeString(body.name || "", 100);

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Nome, email e senha sao obrigatorios" }, { status: 400 });
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Email invalido" }, { status: 400 });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.error }, { status: 400 });
    }

    if (name.length < 2) {
      return NextResponse.json({ error: "Nome deve ter pelo menos 2 caracteres" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Este email ja esta cadastrado" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12); // Increased from 10 to 12 rounds

    await prisma.user.create({
      data: { email, password: hashedPassword, name, role: "viewer", status: "pending" },
    });

    return NextResponse.json({ message: "Cadastro realizado! Aguarde aprovacao do administrador." }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
