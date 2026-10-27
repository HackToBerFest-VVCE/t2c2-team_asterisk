import type { IncomingMessage, ServerResponse } from "node:http";
import mentorHandler, {
  type HeaderValue,
  type MentorResponse,
} from "../server/ai-mentor.js";

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "24kb",
    },
  },
};

export default async function handler(
  request: VercelRequest,
  response: ServerResponse,
): Promise<void> {
  const headers: Record<string, HeaderValue> = {};
  for (const [name, value] of Object.entries(request.headers)) {
    headers[name] = typeof value === "number" ? String(value) : value;
  }

  const mentorResponse: MentorResponse = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      response.setHeader(name, value);
    },
    json(value) {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify(value));
    },
    end() {
      response.end();
    },
  };

  await mentorHandler({
    method: request.method,
    headers,
    body: request.body,
  }, mentorResponse);
}
