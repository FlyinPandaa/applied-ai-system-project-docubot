# DocuBot Web — Observability and redaction

Minimal standards for logs and metrics on a **public** deployment.

## Request logging (structured)

Each `POST /api/retrieve` should emit one log line or structured record with:

- `requestId` (UUID)
- `route` (`/api/retrieve`)
- `ip` (from `x-forwarded-for` first hop or `x-real-ip`, hashed if policy requires minimization)
- `status` (HTTP)
- `durationMs`
- `snippetCount`
- `refusal` (boolean)
- **Never** log the full `query` string in production if queries may contain secrets; prefer **length** + **hash** (e.g. SHA-256) for correlation.

## BYOK (M2+)

- Accept API keys **only** in **request body** or **short-lived server-side session**, never query strings.
- **Redact** any value resembling `AIza…` / `sk-…` from logs and traces.
- Do not persist BYOK keys in cookies, `localStorage`, or databases.

## Errors

- Log **stack traces** for 5xx only; map known provider errors to **safe** client messages.
- Include `requestId` in JSON error payloads for support.

## Alerts (starter thresholds)

- **429 rate** > **20%** of traffic for 10 minutes → investigate abuse or misconfigured client.
- **5xx rate** > **1%** for 5 minutes → page on-call.
- **p95 latency** for `/api/retrieve` > **2s** (excluding client network) → investigate index size or hot paths.

## Metrics (optional next step)

- Counter: `retrieve_requests_total{status}`
- Histogram: `retrieve_duration_seconds`
- Gauge: `index_chunks` (on deploy)
