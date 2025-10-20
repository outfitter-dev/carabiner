/**
 * Integration tests for the HTTP protocol implementation
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HttpProtocol, HttpProtocolFactory } from "@carabiner/protocol";
import type { HookContext } from "@carabiner/types";
import { isToolHookContext, isUserPromptContext } from "@carabiner/types";

const FIXTURE_PATH = join(process.cwd(), "tests", "fixtures", "events");

function loadFixture(filename: string): Record<string, unknown> {
  const filePath = join(FIXTURE_PATH, filename);
  return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
}

function normalizeFixture<T extends Record<string, unknown>>(body: T): T {
  if ("transcript_path" in body) {
    (body as Record<string, unknown>).transcript_path =
      "/tmp/test-transcript.md";
  }
  return body;
}

function createJsonRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  return new Request("https://hooks.carbiner.dev/run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("HttpProtocol", () => {
  test("parses tool hook context from request", async () => {
    const fixture = normalizeFixture(loadFixture("pretooluse-write.json"));
    const request = createJsonRequest(fixture);

    const protocol = new HttpProtocol(request);
    const input = await protocol.readInput();
    const context = (await protocol.parseContext(input)) as HookContext;

    expect(context.event).toBe("PreToolUse");
    expect(isToolHookContext(context)).toBe(true);

    if (isToolHookContext(context)) {
      expect(context.toolName).toBe("Write");
      expect(context.toolInput).toMatchObject({
        file_path: "/Users/test/project/src/main.ts",
      });
    }
  });

  test("builds success response after writing output", async () => {
    const fixture = normalizeFixture(loadFixture("userpromptsubmit.json"));
    const request = createJsonRequest(fixture);

    const protocol = new HttpProtocol(request);
    const context = await protocol.parseContext(await protocol.readInput());

    expect(isUserPromptContext(context)).toBe(true);

    if (isUserPromptContext(context)) {
      expect(context.userPrompt).toContain("TypeScript");
    }

    await protocol.writeOutput({
      continue: true,
      systemMessage: "Notification handled",
    });

    const response = protocol.getResponse();
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.systemMessage).toBe("Notification handled");
  });

  test("returns warning response for non-successful result", async () => {
    const fixture = normalizeFixture(loadFixture("pretooluse-mcp.json"));
    const request = createJsonRequest(fixture);
    const protocol = new HttpProtocol(request);
    await protocol.parseContext(await protocol.readInput());

    await protocol.writeOutput({ continue: false, stopReason: "warning" });

    const response = protocol.getResponse();
    expect(response.status).toBe(400);

    const payload = await response.json();
    expect(payload.stopReason).toBe("warning");
    expect(payload.continue).toBe(false);
  });

  test("includes error details when configured", async () => {
    const request = createJsonRequest({}, {});
    const protocol = new HttpProtocol(request, { includeErrorDetails: true });

    await protocol.writeError(new Error("critical failure"));
    const response = protocol.getResponse();

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.error).toBe("critical failure");
    expect(payload.type).toBe("Error");
  });

  test("adds CORS headers to OPTIONS response", () => {
    const response = HttpProtocol.createOptionsResponse({
      cors: {
        origin: "https://client.example",
        methods: ["POST"],
        headers: ["Content-Type"],
        credentials: true,
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://client.example"
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type"
    );
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
      "true"
    );
  });

  test("factory creates protocol instances with typed options", async () => {
    const fixture = normalizeFixture(loadFixture("userpromptsubmit.json"));
    const request = createJsonRequest(fixture, { "content-length": "512" });

    const factory = new HttpProtocolFactory();
    const protocol = factory.create({ request });

    const context = await protocol.parseContext(await protocol.readInput());
    expect(context.event).toBe("UserPromptSubmit");
  });
});
