import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import handler, { config } from "../api/ai-mentor";
import vercelConfig from "../vercel.json";

describe("Vercel AI Mentor function entry point", () => {
  it("limits parsed JSON requests to the mentor API's existing 24kb input bound", () => {
    expect(config.api.bodyParser.sizeLimit).toBe("24kb");
    expect(vercelConfig.functions["api/ai-mentor.ts"].maxDuration).toBe(60);
  });

  it("adapts Node requests and responses to the shared handler", async () => {
    const request = {
      method: "GET",
      headers: { host: "opensource-buddy.vercel.app" },
    } as IncomingMessage;
    const responseState = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      ended: false,
    };
    const response = {
      get statusCode() {
        return responseState.statusCode;
      },
      set statusCode(code: number) {
        responseState.statusCode = code;
      },
      setHeader(name: string, value: string) {
        responseState.headers[name] = value;
      },
      end() {
        responseState.ended = true;
      },
    } as unknown as ServerResponse;

    await handler(request, response);

    expect(responseState.statusCode).toBe(405);
    expect(responseState.headers.Allow).toBe("POST, OPTIONS");
    expect(responseState.ended).toBe(true);
  });
});
