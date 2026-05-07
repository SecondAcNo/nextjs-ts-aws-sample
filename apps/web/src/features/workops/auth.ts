const accessTokenStorageKey = "workops.cognito.accessToken";
const codeVerifierStorageKey = "workops.cognito.codeVerifier";

export type AuthMode = "local" | "cognito";

export type CognitoSession = {
  accessToken: string;
};

type CognitoConfig = {
  clientId: string;
  domain: string;
  logoutUri: string;
  redirectUri: string;
};

export function getAuthMode(): AuthMode {
  return process.env.NEXT_PUBLIC_AUTH_MODE === "cognito" ? "cognito" : "local";
}

export function getStoredCognitoSession(): CognitoSession | null {
  const accessToken = window.localStorage.getItem(accessTokenStorageKey);

  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
  };
}

export function clearStoredCognitoSession(): void {
  window.localStorage.removeItem(accessTokenStorageKey);
  window.localStorage.removeItem(codeVerifierStorageKey);
}

export function signOutWithCognito(): void {
  const config = getCognitoConfig();

  clearStoredCognitoSession();

  if (!config) {
    return;
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.logoutUri,
  });

  window.location.assign(`${config.domain}/logout?${params.toString()}`);
}

export async function startCognitoLogin(): Promise<void> {
  const config = getCognitoConfig();

  if (!config) {
    throw new Error("CognitoのWeb設定が不足しています。");
  }

  const codeVerifier = createCodeVerifier();
  const codeChallenge = await createCodeChallenge(codeVerifier);
  window.sessionStorage.setItem(codeVerifierStorageKey, codeVerifier);

  const params = new URLSearchParams({
    client_id: config.clientId,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email",
  });

  window.location.assign(`${config.domain}/oauth2/authorize?${params.toString()}`);
}

export async function completeCognitoLogin(code: string): Promise<CognitoSession> {
  const config = getCognitoConfig();
  const codeVerifier = window.sessionStorage.getItem(codeVerifierStorageKey);

  if (!config || !codeVerifier) {
    throw new Error("Cognitoログインセッションが見つかりません。");
  }

  const response = await fetch(`${config.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error("Cognito認可コードの交換に失敗しました。");
  }

  const tokenResponse = (await response.json()) as {
    access_token?: string;
  };

  if (!tokenResponse.access_token) {
    throw new Error("Cognitoのトークン応答にアクセストークンが含まれていません。");
  }

  window.sessionStorage.removeItem(codeVerifierStorageKey);
  window.localStorage.setItem(accessTokenStorageKey, tokenResponse.access_token);

  return {
    accessToken: tokenResponse.access_token,
  };
}

function getCognitoConfig(): CognitoConfig | null {
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID?.trim();
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN?.trim();
  const redirectUri =
    process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI?.trim() ??
    "http://localhost:3000/";
  const logoutUri =
    process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI?.trim() ??
    redirectUri;

  if (!clientId || !domain) {
    return null;
  }

  return {
    clientId,
    domain: domain.replace(/\/$/, ""),
    logoutUri,
    redirectUri,
  };
}

function createCodeVerifier(): string {
  const randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  return toBase64Url(randomBytes);
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return toBase64Url(new Uint8Array(digest));
}

function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
