import { Buffer } from "node:buffer";

import { handleFetchRequest } from "../http/server";

type ApiGatewayHttpEvent = {
  version?: string;
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
    };
  };
  body?: string | null;
  isBase64Encoded?: boolean;
};

type ApiGatewayHttpResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: false;
};

export async function handler(
  event: ApiGatewayHttpEvent,
): Promise<ApiGatewayHttpResponse> {
  const request = toRequest(event);
  const response = await handleFetchRequest(request);

  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
    isBase64Encoded: false,
  };
}

function toRequest(event: ApiGatewayHttpEvent): Request {
  const headers = new Headers();

  for (const [name, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const host = headers.get("host") ?? "localhost";
  const method = event.requestContext?.http?.method ?? "GET";
  const path = event.rawPath ?? event.requestContext?.http?.path ?? "/";
  const queryString = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const url = `https://${host}${path}${queryString}`;
  const init: RequestInit = {
    headers,
    method,
  };

  if (method !== "GET" && method !== "HEAD" && event.body) {
    if (event.isBase64Encoded) {
      const body = Buffer.from(event.body, "base64");
      init.body = body.toString("utf8");
    } else {
      init.body = event.body;
    }
  }

  return new Request(url, init);
}
