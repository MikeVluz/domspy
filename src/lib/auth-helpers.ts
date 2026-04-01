import { auth } from "./auth";
import { NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 0,
  admin: 1,
  super_admin: 2,
};

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }), session: null };
  }
  return { error: null, session };
}

export async function requireRole(minRole: UserRole) {
  const { error, session } = await requireAuth();
  if (error) return { error, session: null };

  const userLevel = ROLE_HIERARCHY[session!.user.role];
  const requiredLevel = ROLE_HIERARCHY[minRole];

  if (userLevel < requiredLevel) {
    return {
      error: NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 }),
      session: null,
    };
  }

  return { error: null, session: session! };
}
