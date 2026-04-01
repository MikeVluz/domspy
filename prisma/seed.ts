import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter });

  const email = process.env.SUPER_ADMIN_EMAIL || "admin@domspy.com";
  const password = process.env.SUPER_ADMIN_PASSWORD || "admin123";
  const name = process.env.SUPER_ADMIN_NAME || "Super Admin";

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`Super admin already exists: ${email}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: "super_admin",
      status: "active",
    },
  });

  console.log(`Super admin created: ${email}`);
}

main().catch(console.error);
