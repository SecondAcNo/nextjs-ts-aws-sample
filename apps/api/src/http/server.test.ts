import assert from "node:assert/strict";
import type { Server } from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import { prisma } from "../shared/database/prisma";
import { createApiServer } from "./server";

type JsonResponse = {
  status: number;
  body: unknown;
};

let server: Server;
let baseUrl: string;
let originalAuthMode: string | undefined;

describe("HTTP API", () => {
  before(async () => {
    originalAuthMode = process.env.AUTH_MODE;
    process.env.AUTH_MODE = "local";
    await ensureLocalUsers();

    server = createApiServer();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await prisma.$disconnect();

    setOptionalEnv("AUTH_MODE", originalAuthMode);
  });

  it("returns health without authentication", async () => {
    const response = await getJson("/health");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      ok: true,
    });
  });

  it("rejects /me without a local auth header", async () => {
    const response = await getJson("/me");

    assert.equal(response.status, 401);
    assertBodyHasError(response.body, "UNAUTHORIZED");
  });

  it("returns the authenticated local user from /me", async () => {
    const response = await getJson("/me", "manager@example.com");

    assert.equal(response.status, 200);
    assertUser(response.body, "manager@example.com", "manager");
  });

  it("allows admins to access /admin/users", async () => {
    const response = await getJson("/admin/users", "admin@example.com");

    assert.equal(response.status, 200);
    assertUsersResponseIncludes(response.body, "admin@example.com");
  });

  it("rejects managers from /admin/users", async () => {
    const response = await getJson("/admin/users", "manager@example.com");

    assert.equal(response.status, 403);
    assertBodyHasError(response.body, "FORBIDDEN");
  });

  it("rejects employees from /admin/users", async () => {
    const response = await getJson("/admin/users", "employee@example.com");

    assert.equal(response.status, 403);
    assertBodyHasError(response.body, "FORBIDDEN");
  });

  it("rejects Cognito mode requests without a bearer token", async () => {
    process.env.AUTH_MODE = "cognito";

    const response = await getJson("/me");

    assert.equal(response.status, 401);
    assertBodyHasError(response.body, "UNAUTHORIZED");

    setOptionalEnv("AUTH_MODE", originalAuthMode);
  });

  it("rejects malformed Cognito bearer tokens", async () => {
    process.env.AUTH_MODE = "cognito";

    const response = await getJsonWithHeaders("/me", {
      authorization: "Bearer invalid-token",
    });

    assert.equal(response.status, 401);
    assertBodyHasError(response.body, "UNAUTHORIZED");

    setOptionalEnv("AUTH_MODE", originalAuthMode);
  });
});

async function ensureLocalUsers(): Promise<void> {
  await prisma.user.upsert({
    create: {
      email: "employee@example.com",
      name: "Employee User",
      role: "employee",
    },
    update: {
      name: "Employee User",
      role: "employee",
    },
    where: {
      email: "employee@example.com",
    },
  });

  await prisma.user.upsert({
    create: {
      email: "manager@example.com",
      name: "Manager User",
      role: "manager",
    },
    update: {
      name: "Manager User",
      role: "manager",
    },
    where: {
      email: "manager@example.com",
    },
  });

  await prisma.user.upsert({
    create: {
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
    },
    update: {
      name: "Admin User",
      role: "admin",
    },
    where: {
      email: "admin@example.com",
    },
  });
}

async function getJson(
  path: string,
  email?: string,
): Promise<JsonResponse> {
  const headers: Record<string, string> = {};

  if (email) {
    headers["x-dev-user-email"] = email;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers,
  });

  return {
    status: response.status,
    body: (await response.json()) as unknown,
  };
}

async function getJsonWithHeaders(
  path: string,
  headers: Record<string, string>,
): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers,
  });

  return {
    status: response.status,
    body: (await response.json()) as unknown,
  };
}

function assertBodyHasError(body: unknown, error: string): void {
  assert.ok(isRecord(body));
  assert.equal(body.error, error);
}

function assertUser(body: unknown, email: string, role: string): void {
  assert.ok(isRecord(body));
  assert.ok(isRecord(body.user));
  assert.equal(body.user.email, email);
  assert.equal(body.user.role, role);
}

function assertUsersResponseIncludes(body: unknown, email: string): void {
  assert.ok(isRecord(body));
  assert.ok(Array.isArray(body.users));
  assert.equal(
    body.users.some((user) => isRecord(user) && user.email === email),
    true,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setOptionalEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
