import { describe, expect, it, vi } from "vitest";
import {
  extractOpenRouterContent,
  fetchOpenRouterWithRetry,
  openRouterEmptyResponseMessage,
  parseOpenRouterJson,
} from "../supabase/functions/_shared/openRouter";

describe("OpenRouter response parsing", () => {
  it("extracts usable text parts from later choices when the first is empty", () => {
    expect(extractOpenRouterContent({
      choices: [
        { message: { content: "" } },
        { message: { content: [{ type: "text", text: "{\"skills\":[]}" }] } },
      ],
    })).toBe("{\"skills\":[]}");
  });

  it("parses JSON fenced in a markdown code block or surrounded by brief prose", () => {
    expect(parseOpenRouterJson("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
    expect(parseOpenRouterJson("Here is the result:\n{\"ok\":true}")).toEqual({ ok: true });
  });

  it("identifies output-limit stops and rejects responses without JSON objects", () => {
    expect(openRouterEmptyResponseMessage({
      choices: [{ finish_reason: "length", message: { content: null } }],
    }, "simplification")).toContain("stopped before completing");
    expect(parseOpenRouterJson("plain text without a JSON object")).toBeNull();
  });

  it("retries an empty completion once and returns the valid response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: null } }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "{\"ok\":true}" } }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const response = await fetchOpenRouterWithRetry("https://openrouter.test/chat/completions", {
        method: "POST",
        body: "{}",
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(extractOpenRouterContent(await response.json())).toBe("{\"ok\":true}");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
