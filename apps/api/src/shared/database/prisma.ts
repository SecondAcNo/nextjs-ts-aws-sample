import "../config/env";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const adapter = new PrismaPg(createPoolConfig(connectionString));

export const prisma = new PrismaClient({ adapter });

function createPoolConfig(value: string) {
  const url = new URL(value);
  const sslMode = url.searchParams.get("sslmode");

  if (sslMode !== "no-verify" && sslMode !== "require") {
    return {
      connectionString: value,
    };
  }

  url.searchParams.delete("sslmode");

  return {
    connectionString: url.toString(),
    ssl: {
      rejectUnauthorized: false,
    },
  };
}
