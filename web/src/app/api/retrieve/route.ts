import { NextRequest, NextResponse } from "next/server";
import { getRetriever } from "@/lib/corpus";
import { checkRateLimit, RETRIEVE_RATE_LIMIT } from "@/lib/rate-limit";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "anonymous";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = checkRateLimit(`retrieve:${ip}`, RETRIEVE_RATE_LIMIT);
  if (!limited.ok) {
    const retrySec = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Too many requests", retryAfterMs: limited.retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": String(retrySec) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected JSON object" }, { status: 400 });
  }

  const record = body as { query?: unknown; topK?: unknown };
  const query = typeof record.query === "string" ? record.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  const maxQueryChars = 4000;
  if (query.length > maxQueryChars) {
    return NextResponse.json(
      { error: `query exceeds maximum length (${maxQueryChars} characters)` },
      { status: 400 },
    );
  }

  const topKRaw = record.topK;
  const topK =
    typeof topKRaw === "number" && Number.isFinite(topKRaw) && topKRaw > 0 && topKRaw <= 20
      ? Math.floor(topKRaw)
      : 3;

  const retriever = getRetriever();
  const snippets = retriever.retrieve(query, topK);

  return NextResponse.json({
    snippets,
    refusal: snippets.length === 0,
  });
}
