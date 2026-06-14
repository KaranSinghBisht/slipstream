/** Minimal JSON request/response helpers for the node http server. */
import http from "node:http";

const MAX_BODY = 256 * 1024;

export function json(res: http.ServerResponse, data: unknown): void {
  res.setHeader("content-type", "application/json");
  res.statusCode = 200;
  res.end(JSON.stringify(data));
}

export function sendError(res: http.ServerResponse, code: number, message: string): void {
  res.setHeader("content-type", "application/json");
  res.statusCode = code;
  res.end(JSON.stringify({ error: message }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJson(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("request body too large");
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("invalid JSON body");
  }
}
