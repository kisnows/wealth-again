import { NextRequest } from "next/server";

export function makeJsonRequest(
  url: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const req = new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return new NextRequest(req);
}

export function makeGet(url: string) {
  return makeJsonRequest(url, "GET");
}

