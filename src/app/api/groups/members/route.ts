import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

// Add page to group
export async function POST(req: NextRequest) {
  const { error } = await requireRole("admin");
  if (error) return error;

  try {
    const { pageId, groupId } = await req.json();
    if (!pageId || !groupId) return NextResponse.json({ error: "pageId e groupId obrigatorios" }, { status: 400 });

    // Check if already in this group
    const existing = await prisma.pageGroupMember.findFirst({ where: { pageId, groupId } });
    if (existing) return NextResponse.json({ message: "Ja esta neste grupo" });

    const member = await prisma.pageGroupMember.create({ data: { pageId, groupId } });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Erro: " + String(error) }, { status: 500 });
  }
}

// Remove page from group
export async function DELETE(req: NextRequest) {
  const { error } = await requireRole("admin");
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get("pageId");
    if (!pageId) return NextResponse.json({ error: "pageId obrigatorio" }, { status: 400 });

    await prisma.pageGroupMember.deleteMany({ where: { pageId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro: " + String(error) }, { status: 500 });
  }
}
