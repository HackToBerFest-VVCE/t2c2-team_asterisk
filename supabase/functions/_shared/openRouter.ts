import { isRecord } from "./http.ts";

function textFromContent(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!Array.isArray(value)) return null;

  const parts = value.flatMap((part) => {
    if (typeof part === "string") return [part];
    if (!isRecord(part)) return [];
    if (typeof part.text === "string") return [part.text];
    if (isRecord(part.text) && typeof part.text.value === "string") return [part.text.value];
    return [];
  });
  const text = parts.join("\n").trim();
  return text || null;
}

export function extractOpenRouterContent(completion: unknown): string | null {
  if (!isRecord(completion) || !Array.isArray(completion.choices)) return null;

  for (const choice of completion.choices) {
    if (!isRecord(choice) || !isRecord(choice.message)) continue;
    const text = textFromContent(choice.message.content);
    if (text) return text;
  }
  return null;
}

export function parseOpenRouterJson(content: string): unknown | null {
  const trimmed = content.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  for (const candidate of [trimmed, withoutFence]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next supported response shape.
    }
  }

  const objectStart = withoutFence.indexOf("{");
  const objectEnd = withoutFence.lastIndexOf("}");
  if (objectStart < 0 || objectEnd <= objectStart) return null;
  try {
    return JSON.parse(withoutFence.slice(objectStart, objectEnd + 1));
  } catch {
    return null;
  }
}

export async function fetchOpenRouterWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, init);
    if (!response.ok || attempt === 1) return response;

    try {
      const completion: unknown = await response.clone().json();
      const content = extractOpenRouterContent(completion);
      if (content && parseOpenRouterJson(content) !== null) return response;
    } catch {
      // Retry transient malformed or empty provider responses once.
    }
  }
  throw new Error("OpenRouter retry ended unexpectedly.");
}

export function openRouterEmptyResponseMessage(completion: unknown, subject: string): string {
  if (isRecord(completion) && Array.isArray(completion.choices)) {
    const stoppedByLength = completion.choices.some((choice) =>
      isRecord(choice) && choice.finish_reason === "length"
    );
    if (stoppedByLength) {
      return `The AI provider stopped before completing the ${subject}. Try again or choose a model with a larger output limit.`;
    }
  }
  return `The AI provider returned no usable text for the ${subject}. Retry, or choose a chat-completion model that supports JSON output.`;
}
