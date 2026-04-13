# DocuBot Web — External documentation fetch (stretch / post-MVP)

Fetching from **multiple external documentation websites** is a **product direction**, not part of **M0–M2**. Before shipping, resolve the items below.

## Threat model highlights

- **SSRF:** never fetch arbitrary URLs from raw user input without an **allowlist** (domains + path prefixes) or admin-curated list.
- **robots.txt and site ToS:** respect publisher rules; cache responses with attribution.
- **Denial of service:** cap response bytes, total download time, and redirects (e.g. max **5** redirects).
- **Malicious content:** HTML may contain huge hidden text; extract **main content** only; strip scripts.

## Proposed pipeline (sketch)

1. User or admin supplies **approved base URLs** (e.g. `https://docs.example.com/`).
2. Background job or on-demand fetch stores **normalized text** + **source URL** + **retrieved_at**.
3. Chunking and retrieval treat each page like a virtual file: citations show **page title + URL**.

## Operational controls

- **Per-domain rate limit** (e.g. 30 fetches / hour per domain per deployment).
- **Cache TTL** (e.g. 24h) with manual **purge** button for admins.
- **User-agent** string identifying DocuBot; contact email in UA comment if required by host.

## Open PRD questions (§11.5)

- Who configures allowlists: **end user**, **tenant admin**, or **platform admin** only?
- Legal: **Terms of Service** link for “you may only index sites you own or have permission to index.”
