import "../shared/config/env";

import type { IncomingMessage } from "node:http";
import { CognitoJwtVerifier } from "aws-jwt-verify";

import { getDevAuthenticatedUser } from "./dev-auth";
import type { AuthUser } from "../shared/types/auth";
import { prisma } from "../shared/database/prisma";

export type AuthenticatedUser = AuthUser & {
  email: string;
  name: string;
};

export type AuthFailure = {
  statusCode: 401 | 500;
  error: "UNAUTHORIZED" | "AUTH_CONFIGURATION_ERROR";
  message: string;
};

export type AuthResult =
  | {
      ok: true;
      user: AuthenticatedUser;
    }
  | {
      ok: false;
      failure: AuthFailure;
    };

type AuthMode = "local" | "cognito";

type CognitoConfig = {
  userPoolId: string;
  clientId: string;
};

let cachedCognitoVerifier:
  | {
      configKey: string;
      verifier: ReturnType<typeof CognitoJwtVerifier.create>;
    }
  | undefined;

export async function authenticateRequest(
  request: IncomingMessage,
): Promise<AuthResult> {
  return authenticateHeaders((headerName) => getHeaderValue(request, headerName));
}

export async function authenticateFetchRequest(
  request: Request,
): Promise<AuthResult> {
  return authenticateHeaders(
    (headerName) => request.headers.get(headerName) ?? undefined,
  );
}

async function authenticateHeaders(
  getHeader: (headerName: string) => string | undefined,
): Promise<AuthResult> {
  const authMode = getAuthMode();

  if (!authMode) {
    return {
      ok: false,
      failure: {
        statusCode: 500,
        error: "AUTH_CONFIGURATION_ERROR",
        message: "AUTH_MODE must be local or cognito.",
      },
    };
  }

  if (authMode === "local") {
    return authenticateLocalRequest(getHeader);
  }

  return authenticateCognitoRequest(getHeader);
}

function getAuthMode(): AuthMode | null {
  const authMode = process.env.AUTH_MODE ?? "local";

  if (authMode === "local" || authMode === "cognito") {
    return authMode;
  }

  return null;
}

async function authenticateLocalRequest(
  getHeader: (headerName: string) => string | undefined,
): Promise<AuthResult> {
  const email = getHeader("x-dev-user-email");
  const user = await getDevAuthenticatedUser(email);

  if (!user) {
    return {
      ok: false,
      failure: {
        statusCode: 401,
        error: "UNAUTHORIZED",
        message: "Set x-dev-user-email to employee@example.com, manager@example.com, or admin@example.com.",
      },
    };
  }

  return {
    ok: true,
    user,
  };
}

async function authenticateCognitoRequest(
  getHeader: (headerName: string) => string | undefined,
): Promise<AuthResult> {
  const config = getCognitoConfig();

  if (!config) {
    return {
      ok: false,
      failure: {
        statusCode: 500,
        error: "AUTH_CONFIGURATION_ERROR",
        message: "COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set.",
      },
    };
  }

  const token = getBearerToken(getHeader);

  if (!token) {
    return {
      ok: false,
      failure: {
        statusCode: 401,
        error: "UNAUTHORIZED",
        message: "Set Authorization: Bearer <Cognito access token>.",
      },
    };
  }

  try {
    const payload = await getCognitoVerifier(config).verify(token);
    const user = await prisma.user.findUnique({
      where: {
        cognitoSub: payload.sub,
      },
    });

    if (!user) {
      return {
        ok: false,
        failure: {
          statusCode: 401,
          error: "UNAUTHORIZED",
          message: "Authenticated Cognito user is not linked to an application user.",
        },
      };
    }

    return {
      ok: true,
      user: {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  } catch {
    return {
      ok: false,
      failure: {
        statusCode: 401,
        error: "UNAUTHORIZED",
        message: "Cognito token is invalid or expired.",
      },
    };
  }
}

function getCognitoConfig(): CognitoConfig | null {
  const userPoolId = process.env.COGNITO_USER_POOL_ID?.trim();
  const clientId = process.env.COGNITO_CLIENT_ID?.trim();

  if (!userPoolId || !clientId) {
    return null;
  }

  return {
    userPoolId,
    clientId,
  };
}

function getCognitoVerifier(config: CognitoConfig): ReturnType<typeof CognitoJwtVerifier.create> {
  const configKey = `${config.userPoolId}:${config.clientId}`;

  if (cachedCognitoVerifier?.configKey === configKey) {
    return cachedCognitoVerifier.verifier;
  }

  const verifier = CognitoJwtVerifier.create({
    clientId: config.clientId,
    tokenUse: "access",
    userPoolId: config.userPoolId,
  });

  cachedCognitoVerifier = {
    configKey,
    verifier,
  };

  return verifier;
}

function getBearerToken(
  getHeader: (headerName: string) => string | undefined,
): string | null {
  const authorization = getHeader("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function getHeaderValue(
  request: IncomingMessage,
  headerName: string,
): string | undefined {
  const value = request.headers[headerName];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
