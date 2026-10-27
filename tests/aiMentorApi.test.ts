import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  fetch: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

import handler, { type MentorRequest, type MentorResponse } from "../server/ai-mentor";

const guide = {
  issue_explanation: "The issue describes a keyboard navigation problem.",
  pull_request_explanation: "A pull request proposes your change to the project for review.",
  expected_outcome: "Keyboard users can move through the menu.",
  solution_approach: "Trace the menu focus behavior and correct the key handling without changing unrelated interactions.",
  prerequisites: ["Basic TypeScript and keyboard accessibility knowledge."],
  repository_setup_workflow: [
    "Read the repository README and contribution instructions.",
    "Follow the setup steps documented by the project.",
    "Create a branch from the current default branch.",
  ],
  possible_root_causes: ["A focus handler may not update the active item."],
  files_to_inspect: ["Suggested area only: menu keyboard event handling."],
  implementation_steps: [
    "Read the issue carefully and write down the expected keyboard behavior.",
    "Reproduce the problem with the same menu interaction described by the issue.",
    "Inspect the related keyboard and focus handling, starting with areas explicitly named in the issue.",
    "Trace how focus changes for each supported key and compare it with the expected behavior.",
    "Make the smallest change that addresses the mismatch without changing unrelated menu behavior.",
    "Add or update focused tests for the expected key behavior and relevant edge cases.",
  ],
  example_code: "// Illustrative only",
  test_commands: ["Check repository instructions for the appropriate test command."],
  edge_cases: ["The menu contains no focusable items."],
  pull_request_checklist: ["Link the issue.", "Describe and verify the change."],
};

function makeRequest(
  body: unknown = {
    issueId: 55,
    user_id: "untrusted-browser-user",
    title: "Untrusted browser title",
    body: "Untrusted browser description",
    url: "https://github.com/example/menu/issues/4",
    repository: "example/menu",
    labels: ["help wanted"],
    language: "TypeScript",
  },
  options: { method?: string; origin?: string; authorization?: string } = {},
): MentorRequest {
  return {
    method: options.method ?? "POST",
    headers: {
      host: "localhost:5173",
      origin: options.origin ?? "http://localhost:5173",
      authorization: options.authorization ?? "Bearer test-user-token",
      "content-type": "application/json",
    },
    body,
  } as MentorRequest;
}

function makeResponse() {
  const state: { statusCode: number; headers: Record<string, string>; body?: unknown } = {
    statusCode: 200,
    headers: {},
  };
  const response = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      state.headers[name] = value;
      return this;
    },
    json(value: unknown) {
      state.body = value;
      return this;
    },
    end() {
      return this;
    },
  };
  return { response: response as MentorResponse, state };
}

function configureFetch(
  provider: (url: string) => Promise<Response> = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(guide) } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } }),
  docsAvailable = true,
) {
  mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/repos/example/menu/issues/4")) {
      return new Response(JSON.stringify({
        id: 55,
        number: 4,
        title: "Keyboard navigation is broken",
        body: "Arrow keys do not move focus.",
        html_url: "https://github.com/example/menu/issues/4",
        labels: [{ name: "help wanted" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/repos/example/menu/readme")) {
      return docsAvailable
        ? new Response("# Menu\n\nRun `npm test` to test keyboard behavior. See `src/menu/keyboard.ts`.", { status: 200 })
        : new Response(null, { status: 404 });
    }
    if (!docsAvailable || url.endsWith("/repos/example/menu/contents/CONTRIBUTING.md")) {
      return new Response(null, { status: 404 });
    }
    if (url.endsWith("/repos/example/menu/contents/.github/CONTRIBUTING.md")) {
      return new Response("# Contributing\n\nAdd a focused test and link the issue in your pull request.", { status: 200 });
    }
    if (url.includes("/contents/")) return new Response(null, { status: 404 });
    return provider(url);
  });
}

describe("Local AI mentor API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("OPENROUTER_API_KEY", "server-test-key");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-4o-mini");
    vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-anon-key");
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("NODE_ENV", "development");
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "verified-user-id" } },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
      from: vi.fn(() => ({ insert: mocks.insert })),
    });
    configureFetch();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("authenticates, requests a structured guide, and saves through the user's RLS session", async () => {
    const { response, state } = makeResponse();
    await handler(makeRequest() , response);

    expect(state.statusCode).toBe(200);
    expect((state.body as { guide: typeof guide }).guide.issue_explanation).toBe(guide.issue_explanation);
    expect((state.body as { guide: typeof guide & { context_note: string } }).guide.context_note).toMatch(/were inspected/);
    expect(mocks.getUser).toHaveBeenCalledWith("test-user-token");
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://supabase.example",
      "public-anon-key",
      expect.objectContaining({ global: { headers: { Authorization: "Bearer test-user-token" } } }),
    );
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "verified-user-id",
      issue_id: 55,
      model: "openai/gpt-4o-mini",
    }));
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer server-test-key" }),
      }),
    );
    expect(state.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
    const providerCall = mocks.fetch.mock.calls.find(([url]) => String(url) === "https://openrouter.ai/api/v1/chat/completions");
    const requestBody = JSON.parse(providerCall?.[1]?.body as string) as {
      max_tokens: number;
      messages: Array<{ content: string }>;
    };
    expect(requestBody.max_tokens).toBe(6000);
    expect(requestBody.messages[0].content).toMatch(/5-7 short ordered actions/);
    expect(requestBody.messages[1].content).toContain("Run `npm test`");
    expect(requestBody.messages[1].content).toContain(".github/CONTRIBUTING.md");
    expect(requestBody.messages[1].content).toContain("Keyboard navigation is broken");
    expect(requestBody.messages[1].content).toContain("Arrow keys do not move focus.");
    expect(requestBody.messages[1].content).not.toContain("Untrusted browser title");
    expect((state.body as { guide: typeof guide & { setup: string[] } }).guide.setup)
      .toEqual(guide.repository_setup_workflow);
    expect((state.body as { guide: typeof guide & { links: { readme: string | null; contributing: string | null } } }).guide.links).toMatchObject({
      readme: "https://github.com/example/menu#readme",
      contributing: "https://github.com/example/menu/blob/HEAD/.github/CONTRIBUTING.md",
    });
  });

  it("requires authentication and does not call OpenRouter for invalid sessions", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed or mismatched GitHub issue URLs", async () => {
    const { response, state } = makeResponse();
    await handler(makeRequest({
      title: "Issue",
      body: null,
      url: "https://github.com/other/repo/issues/4",
      repository: "example/menu",
      labels: [],
      language: null,
    }), response);

    expect(state.statusCode).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns a useful non-AI fallback when the OpenRouter key is missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(200);
    const generated = (state.body as { guide: typeof guide & {
      generated_by: string;
      links: { readme: string | null; contributing: string | null };
      files_to_inspect: string[];
    } }).guide;
    expect(generated.generated_by).toBe("fallback");
    expect(generated.issue_explanation).toContain("Arrow keys do not move focus.");
    expect(generated.pull_request_explanation).toMatch(/pull request/i);
    expect(generated.links).toMatchObject({
      readme: "https://github.com/example/menu#readme",
      contributing: "https://github.com/example/menu/blob/HEAD/.github/CONTRIBUTING.md",
    });
    expect(generated.files_to_inspect).toEqual([]);
    expect(mocks.fetch.mock.calls.some(([url]) => String(url) === "https://openrouter.ai/api/v1/chat/completions")).toBe(false);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ model: "fallback" }));
  });

  it("does not invent setup commands or documentation links when GitHub has no docs", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    configureFetch(undefined, false);
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(200);
    const generated = (state.body as { guide: typeof guide & {
      links: { readme: string | null; contributing: string | null };
      source_notes: string[];
      setup: string[];
      repository_setup_workflow: string[];
      test_commands: string[];
    } }).guide;
    expect(generated.links).toMatchObject({ readme: null, contributing: null });
    expect(generated.source_notes.join(" ")).toMatch(/no repository README/i);
    expect(generated.repository_setup_workflow.join(" ")).toMatch(/unknown/i);
    expect(generated.setup.join(" ")).not.toMatch(/npm|pnpm|yarn|pip|cargo/i);
    expect(generated.test_commands.join(" ")).not.toMatch(/npm test|pnpm test|yarn test/i);
  });

  it("preserves OpenRouter rate-limit errors as HTTP 429", async () => {
    configureFetch(async () => new Response("{}", { status: 429 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(429);
  });

  it("surfaces GitHub issue rate limits before generating a guide", async () => {
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) =>
      String(input).endsWith("/repos/example/menu/issues/4")
        ? new Response("{}", { status: 403, headers: { "X-RateLimit-Reset": "1793130000" } })
        : new Response("{}", { status: 404 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(429);
    expect(state.body).toEqual(expect.objectContaining({ error: expect.stringContaining("rate limit") }));
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns an actionable response when OpenRouter exceeds the request timeout", async () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    configureFetch(async (url) => {
      if (url === "https://openrouter.ai/api/v1/chat/completions") throw timeout;
      return new Response("{}", { status: 404 });
    });
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(504);
    expect(state.body).toEqual(expect.objectContaining({
      error: expect.stringContaining("within 45 seconds"),
    }));
    expect(mocks.fetch.mock.calls.filter(([url]) => String(url) === "https://openrouter.ai/api/v1/chat/completions")).toHaveLength(1);
  });

  it("returns clear CORS preflight and method responses", async () => {
    const options = makeResponse();
    await handler(makeRequest(undefined, { method: "OPTIONS" }), options.response);
    expect(options.state.statusCode).toBe(204);
    expect(options.state.headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");

    const get = makeResponse();
    await handler(makeRequest(undefined, { method: "GET" }), get.response);
    expect(get.state.statusCode).toBe(405);
  });

  it("rejects oversized issue requests before contacting OpenRouter", async () => {
    const { response, state } = makeResponse();
    await handler(makeRequest({
      title: "Issue",
      body: "x".repeat(25_000),
      url: "https://github.com/example/menu/issues/4",
      repository: "example/menu",
      labels: [],
      language: null,
    }), response);

    expect(state.statusCode).toBe(413);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid OpenRouter guide JSON without saving it", async () => {
    configureFetch(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"issue_explanation":"partial"}' } }],
    }), { status: 200 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(502);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("accepts OpenRouter text content returned as text parts", async () => {
    configureFetch(async () => new Response(JSON.stringify({
      choices: [{
        finish_reason: "stop",
        message: {
          content: [{ type: "text", text: JSON.stringify(guide) }],
        },
      }],
    }), { status: 200 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(200);
    expect((state.body as { guide: typeof guide }).guide.issue_explanation).toBe(guide.issue_explanation);
  });

  it("explains when OpenRouter cuts off generation at its output limit", async () => {
    configureFetch(async () => new Response(JSON.stringify({
      choices: [{
        finish_reason: "length",
        message: { content: '{"issue_explanation":"partial' },
      }],
    }), { status: 200 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(502);
    expect(state.body).toEqual(expect.objectContaining({
      error: expect.stringContaining("stopped before completing"),
    }));
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns an actionable error when OpenRouter returns no content", async () => {
    configureFetch(async () => new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: null } }],
    }), { status: 200 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(502);
    expect(state.body).toEqual(expect.objectContaining({
      error: expect.stringContaining("returned no guide text"),
    }));
  });

  it("retries once when OpenRouter returns malformed response JSON", async () => {
    let providerAttempt = 0;
    configureFetch(async () => ++providerAttempt === 1
      ? new Response("<html>temporary upstream error</html>", { status: 200 })
      : new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(guide) } }],
      }), { status: 200 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(200);
    expect(providerAttempt).toBe(2);
    expect((state.body as { guide: typeof guide }).guide.issue_explanation).toBe(guide.issue_explanation);
  });

  it("returns a retryable error if both OpenRouter response bodies are malformed", async () => {
    let providerAttempt = 0;
    configureFetch(async () => new Response(++providerAttempt === 1 ? "not JSON" : "still not JSON", { status: 200 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(502);
    expect(providerAttempt).toBe(2);
    expect(state.body).toEqual(expect.objectContaining({
      error: expect.stringContaining("malformed response JSON twice"),
    }));
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("does not allow a browser-supplied user id to own the saved guide", async () => {
    const { response } = makeResponse();
    await handler(makeRequest(), response);

    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "verified-user-id" }));
    expect(mocks.insert).not.toHaveBeenCalledWith(expect.objectContaining({ user_id: "untrusted-browser-user" }));
  });
});
