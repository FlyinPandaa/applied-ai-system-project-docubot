# DocuBot Web — Authentication and rate limits (MVP)

This document locks **provisional** values for the public SaaS MVP described in the PRD. Adjust after real traffic and cost data.

## MVP authentication strategy

- **Default:** anonymous use with **no accounts** for v1 retrieval and later RAG.
- **Abuse control:** combine **per-IP** and **per-session** limits (session id via signed or random cookie when implemented; until then, IP-only for stateless routes).
- **Upgrade path:** add **magic link** or **OAuth** when shared IPs or abuse require per-user quotas.

## Rate limits (provisional)


| Surface              | Window      | Limit                    | Notes                                                                                                    |
| -------------------- | ----------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `POST /api/retrieve` | 1 hour      | **120** requests per IP  | Implemented in `web/src/lib/rate-limit.ts` as `RETRIEVE_RATE_LIMIT`. Returns **429** with `Retry-After`. |
| Query body           | per request | **4000** characters max  | Implemented in `web/src/app/api/retrieve/route.ts`.                                                      |
| `topK`               | per request | **1–20** (default **3**) | Prevents huge payloads.                                                                                  |


## Future (M2+) — hybrid Gemini keys

- **Server key:** same rate limits apply; optionally **lower** caps for expensive `POST` routes that call Gemini.
- **BYOK:** do **not** persist keys; do **not** log request bodies containing keys; apply **separate** stricter per-IP limits if abuse appears.

## Action items when moving to production

- Put limits in **environment variables** for tuning without redeploying code.
- Add **CAPTCHA** or **signed session** if automated abuse is observed.
- Document limits in the **public FAQ** and API error messages.

