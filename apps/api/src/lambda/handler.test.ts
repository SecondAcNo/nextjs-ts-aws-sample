import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handler } from "./handler";

describe("Lambda API handler", () => {
  it("routes API Gateway HTTP API events through the shared API handler", async () => {
    const response = await handler({
      headers: {
        host: "example.com",
      },
      isBase64Encoded: false,
      rawPath: "/health",
      rawQueryString: "",
      requestContext: {
        http: {
          method: "GET",
          path: "/health",
        },
      },
      version: "2.0",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body) as unknown, {
      ok: true,
    });
  });
});
