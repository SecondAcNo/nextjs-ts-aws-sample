import path from "node:path";
import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

loadRootPublicEnv();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_AUTH_MODE: process.env.NEXT_PUBLIC_AUTH_MODE,
    NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    NEXT_PUBLIC_COGNITO_DOMAIN: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
    NEXT_PUBLIC_COGNITO_REDIRECT_URI: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI,
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;

function loadRootPublicEnv(): void {
  const rootEnvPath = path.resolve(__dirname, "../../.env");

  try {
    const rootEnv = readFileSync(rootEnvPath, "utf8");

    for (const line of rootEnv.split(/\r?\n/)) {
      const match = line.match(/^(NEXT_PUBLIC_[A-Z0-9_]+)=(.*)$/);

      if (!match?.[1]) {
        continue;
      }

      process.env[match[1]] ??= match[2]?.replace(/^"|"$/g, "") ?? "";
    }
  } catch {
    // Root .env is optional for CI/build environments.
  }
}
