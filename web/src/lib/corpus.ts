import { buildRetriever, defaultDocsPath } from "./retrieval";

let cached: ReturnType<typeof buildRetriever> | null = null;

export function getRetriever(): ReturnType<typeof buildRetriever> {
  if (!cached) cached = buildRetriever(defaultDocsPath());
  return cached;
}
