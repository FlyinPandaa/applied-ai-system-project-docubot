# DocuBot Web

Next.js app for **retrieval-only** search over the bundled Markdown corpus (`content/docs`), aligned with the Python `DocuBot` lab.

## Commands

```bash
npm install
npm run dev      # http://localhost:3000
npm run test     # Vitest golden tests (retrieval parity)
npm run lint
npm run build
```

## API

- `GET /api/health` — liveness JSON.
- `POST /api/retrieve` — body `{ "query": string, "topK"?: number }` → `{ snippets: { filename, text, score }[], refusal: boolean }`.

Rate limits and other operational defaults live in the repository root folder `web-spec/`.
