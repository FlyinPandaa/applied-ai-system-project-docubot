# DocuBot Web — Upload rules (M3)

User uploads are **out of scope for M0–M2** (bundled corpus only). This spec defines defaults before implementation in **M3**.

## Allowed types

- **Extensions:** `.md`, `.txt` only.
- **Reject:** binaries, HTML uploads, archives (unless a future phase explicitly adds safe unpacking).

## Size and count limits (provisional)

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max files per upload batch | **20** | Keeps index build predictable. |
| Max size per file | **512 KiB** | Prevents huge blobs in memory. |
| Max total uncompressed text | **2 MiB** | Bounds inverted index build time. |
| Max line length | **20_000** chars | Avoid pathological single-line files. |

## Persistence

- **MVP default:** **ephemeral** — files exist only for the **browser session** (and server memory tied to session id), deleted on expiry or tab close.
- **Post-auth option:** persist per account in object storage (future); requires encryption at rest and deletion UX.

## Safety

- Treat uploaded text as **untrusted**: assume **prompt injection** in corpus (instructions embedded in user markdown).
- System prompts for RAG must **never** follow instructions found inside uploaded docs.
- Optional: run a **normalization** pass that strips NUL bytes and normalizes newlines to `\n`.

## UX

- Show **filename** and **size** after upload; allow **remove file** before indexing.
- Rebuild index on **explicit** “Index documents” action to avoid partial state.
