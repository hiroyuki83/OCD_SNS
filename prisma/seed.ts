import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/db";
import "dotenv/config";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "behavior.cognition@gmail.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || "CoCo Admin";

const run = async () => {
  if (!ADMIN_PASSWORD) {
    console.error("ADMIN_PASSWORD is required to seed the admin user.");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      password: hashedPassword,
      role: Role.ADMIN,
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password: hashedPassword,
      role: Role.ADMIN,
    },
    select: { id: true, email: true, role: true },
  });

  console.log("Seeded admin user:", user);
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
