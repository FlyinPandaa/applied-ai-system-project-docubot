# DocuBot Model Card

This model card is a short reflection on your DocuBot system. Fill it out after you have implemented retrieval and experimented with all three modes:

1. Naive LLM over full docs  
2. Retrieval only  
3. RAG (retrieval plus LLM)

Use clear, honest descriptions. It is fine if your system is imperfect.

---

## 1. System Overview

**What is DocuBot trying to do?**  
DocuBot is a documentation assistant that answers developer questions about a codebase by reading a small set of markdown files in the `docs/` folder. It supports three modes of operation ranging from pure LLM generation to pure retrieval, and a hybrid RAG approach.

**What inputs does DocuBot take?**  
- A natural language question from the user  
- A folder of `.md` / `.txt` documentation files (`docs/`)  
- An optional `GEMINI_API_KEY` environment variable to enable LLM features

**What outputs does DocuBot produce?**  
A text answer: either a formatted snippet from the docs (retrieval only), an LLM-generated answer grounded in retrieved snippets (RAG), or a refusal message ("I do not know based on these docs.") when evidence is insufficient.

---

## 2. Retrieval Design

**How does your retrieval system work?**

- **Chunking:** Each document is split into paragraph-level chunks on double newlines (`\n\n`). Empty paragraphs are skipped. This gives finer-grained retrieval than returning whole files.
- **Indexing:** An inverted index maps lowercase tokens (punctuation-stripped) to the chunk indices they appear in.
- **Scoring:** For each candidate chunk, a content-word overlap score is computed. Stop words (common English words plus domain-specific generics like "docs") are filtered out before scoring, so only meaningful terms count.
- **Retrieval:** Chunks are ranked by score descending. Any chunk scoring below `MIN_SCORE = 1` is excluded as a guardrail against weak matches.

**What tradeoffs did you make?**

- **Paragraph chunks vs. whole docs:** Paragraph chunking returns focused, relevant text instead of dumping entire files. The tradeoff is that some answers span multiple paragraphs and no single chunk contains the full answer.
- **Stop word filtering:** Filtering stop words makes the guardrail effective (topics absent from the docs return nothing), but increases the risk of missing chunks that only match via common words.
- **Simplicity vs. precision:** The system uses pure keyword overlap, not semantic similarity. Paraphrased queries (e.g., "fields stored" when the doc says "Stores columns") may miss relevant chunks.

---

## 3. Use of the LLM (Gemini)

**When does DocuBot call the LLM and when does it not?**

- **Naive LLM mode:** Calls Gemini with a generic prompt and the question only. The full docs corpus is passed in but the current prompt ignores it, so the model answers from general training knowledge — not from the actual project docs.
- **Retrieval only mode:** Never calls the LLM. Returns raw retrieved paragraphs directly to the user.
- **RAG mode:** Calls retrieval first, then passes only the top-k chunks to Gemini along with strict grounding instructions. If no chunks are retrieved, refuses without calling the LLM.

**What instructions do you give the LLM to keep it grounded?**

The RAG prompt instructs Gemini to:
- Answer using **only** the information in the provided snippets
- Refuse with `"I do not know based on the docs I have."` if the snippets are not sufficient
- Cite the source file(s) it relied on when it does answer
- Never invent functions, endpoints, or configuration values not present in the snippets

---

## 4. Experiments and Comparisons

Same queries tested across all three modes:

| Query | Naive LLM | Retrieval only | RAG | Notes |
|-------|-----------|----------------|-----|-------|
| Where is the auth token generated? | **Harmful** — confident but completely generic. Talks about OAuth, SSO, JWT in general terms. Never mentions `generate_access_token` or `auth_utils.py`. | **Partially helpful** — returns AUTH.md intro paragraph (mentions "token generation") but misses the specific function name. | **Cautious** — refused with "I do not know." The retrieved intro snippet wasn't specific enough for the LLM to answer. | RAG is most honest; Naive is most misleading. |
| How does a client refresh an access token? | Not tested (same pattern as above — would give generic OAuth answer). | **Partially helpful** — retrieves API_REFERENCE.md snippets about tokens generally; the `POST /api/refresh` endpoint chunk was not ranked in top-3. | **Refused** — retrieved snippets were too generic, LLM correctly refused. | Retrieval ranking issue: the most relevant chunk scored lower than general token mentions. |
| Which endpoint lists all users? | Not tested. | **Helpful** — correctly surfaces `"Returns a list of all users. Only accessible to admins."` from API_REFERENCE.md. | Not tested. | Clean retrieval hit; answer is in one paragraph. |
| Is there any mention of payment processing in these docs? | **Harmful** — didn't use the docs at all. Asked the user to paste the documents in, then listed generic payment processing keywords to search for. | **Correct refusal** — returned "I do not know based on these docs." after stop-word filtering left no matching content words. | Not tested. | Mode 1 fundamentally broken for off-topic detection; Mode 2 guardrail works correctly. |

**What patterns did you notice?**

- **Naive LLM looks impressive but is untrustworthy:** It produces polished, detailed answers with headers and bullet points — but they reflect general internet knowledge, not the actual project. For payment processing, it asked the user to provide the docs, completely ignoring the `all_text` it was given. It would be dangerous in production: a developer following its advice might configure OAuth or use third-party SDKs that have nothing to do with the actual codebase.

- **Retrieval only is accurate but hard to interpret:** The raw paragraph text is faithful to the source but requires the developer to read and connect the dots themselves. It's most useful when one paragraph directly answers the question (e.g., "Which endpoint lists all users?"), and least useful when the answer is spread across multiple sections.

- **RAG is most honest, but overcautious with paragraph-level chunks:** The strict grounding prompt makes Gemini refuse when snippets aren't specific enough — which is the right behavior. However, because paragraph chunks are small, many answers require synthesizing two or three paragraphs that aren't retrieved together. RAG failed on "Where is the auth token generated?" even though the answer is clearly in AUTH.md, because the retrieved intro paragraph only mentions the topic, not the specific function.

- **RAG still fails when retrieval fails:** If the wrong chunks are retrieved, the LLM cannot fix it. The quality ceiling of RAG is bounded by retrieval quality.

---

## 5. Failure Cases and Guardrails

**Failure case 1: Naive LLM ignores the actual docs**  
- Question: "Is there any mention of payment processing in these docs?"  
- What happened: The model replied asking the user to paste the documents in, then listed generic payment-related keywords. It did not use `all_text` at all.  
- What should have happened: The model should have read the provided docs and responded "No, there is no mention of payment processing in these documents."

**Failure case 2: RAG refuses on answerable questions when the key chunk isn't top-ranked**  
- Question: "Where is the auth token generated?"  
- What happened: The answer (`generate_access_token` in `auth_utils.py`) is clearly in AUTH.md, but the retrieved snippet was the intro paragraph. The LLM correctly refused because the intro doesn't contain the answer.  
- What should have happened: The correct chunk (the "Token Generation" section of AUTH.md) should have been ranked #1.

**When should DocuBot say "I do not know based on the docs I have"?**

1. When no content words from the query match any chunk in the index (e.g., topics not covered in the docs at all, like payment processing).
2. When the retrieved snippets discuss related topics but don't contain the specific information needed to answer the question (e.g., auth intro paragraph for a question about a specific function name).

**What guardrails did you implement?**

- **Stop word filtering:** Query terms like "is", "the", "any", "docs" are excluded from scoring so ubiquitous words don't create false positives.
- **Minimum score threshold (`MIN_SCORE = 1`):** Chunks with zero content-word matches are excluded. This causes DocuBot to refuse when no meaningful evidence exists.
- **LLM prompt refusal rule:** The RAG prompt instructs Gemini to reply "I do not know based on the docs I have." when snippets are insufficient. This prevents hallucination when retrieval is weak.
- **Retrieval gate in RAG:** If `retrieve()` returns an empty list, `answer_rag()` returns the refusal string immediately without calling the LLM.

---

## 6. Limitations and Future Improvements

**Current limitations**

1. **Keyword-only matching:** The scorer counts word overlap but cannot handle synonyms or paraphrasing. "Which columns are in the users table?" and "Which fields are stored in the users table?" may score differently depending on exact wording in the docs.
2. **Naive mode doesn't actually use the docs:** `naive_answer_over_full_docs` passes `all_text` to the function but the current prompt ignores it, so Mode 1 always answers from general training knowledge regardless of the actual content.
3. **Paragraph chunks can split context:** An answer that spans two adjacent paragraphs (e.g., a section header followed by its content) may never appear in a single retrieved chunk, causing both retrieval-only and RAG modes to miss the answer.

**Future improvements**

1. **Fix the naive mode prompt** to actually include `all_text` in the prompt so Mode 1 uses the real docs instead of generic knowledge.
2. **Use semantic/embedding-based retrieval** (e.g., sentence embeddings + cosine similarity) instead of keyword overlap to handle paraphrased queries correctly.
3. **Increase chunk size or use overlapping windows** so that answers spanning adjacent paragraphs are captured in at least one chunk.

---

## 7. Responsible Use

**Where could this system cause real world harm if used carelessly?**

- **Mode 1 (Naive LLM) is actively dangerous** in a real codebase context: it produces confident, well-formatted answers based on general knowledge rather than the actual project docs. A developer could follow its instructions and configure something that doesn't exist in the codebase.
- **Silent retrieval failures in RAG** could mislead developers into thinking a topic isn't covered in the docs when it simply wasn't retrieved. The "I do not know" response looks the same whether the topic is absent or just poorly ranked.
- **Outdated docs lead to wrong answers:** DocuBot trusts the `docs/` folder completely. If the docs are stale, all modes will propagate outdated information without any warning.

**What instructions would you give real developers who want to use DocuBot safely?**

- Always verify answers against the actual source files before acting on them, especially for security-sensitive topics like authentication and database configuration.
- Treat "I do not know" as "not found in retrieved context," not necessarily "not in the docs" — try rephrasing the question if the answer seems like it should exist.
- Keep docs up to date. DocuBot's accuracy is entirely bounded by the quality and currency of the files in `docs/`.
- Do not use Naive LLM mode (Mode 1) for project-specific questions until the prompt is fixed to include the actual document text.

---
