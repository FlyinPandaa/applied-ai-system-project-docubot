import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRetriever } from "./retrieval";

const docsDir = path.join(process.cwd(), "content", "docs");

describe("retrieval golden (bundled corpus)", () => {
  const retriever = buildRetriever(docsDir);

  it("finds AUTH.md for auth token question", () => {
    const results = retriever.retrieve("Where is the auth token generated?", 5);
    const files = results.map((r) => r.filename);
    expect(files).toContain("AUTH.md");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("returns DATABASE.md for users table question", () => {
    const results = retriever.retrieve("Which fields are stored in the users table?", 5);
    const files = results.map((r) => r.filename);
    expect(files).toContain("DATABASE.md");
  });

  it("refuses off-topic payment question (empty or no meaningful hits)", () => {
    const results = retriever.retrieve(
      "Is there any mention of payment processing in these docs?",
      5,
    );
    expect(results.length).toBe(0);
  });
});
