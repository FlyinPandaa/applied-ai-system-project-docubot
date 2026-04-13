import fs from "node:fs";
import path from "node:path";

/** Matches `DocuBot.STOP_WORDS` in `docubot.py`. */
export const STOP_WORDS = new Set<string>([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "of", "in", "on", "at",
  "to", "for", "with", "by", "from", "up", "about", "into", "through",
  "and", "or", "but", "not", "if", "as", "it", "its", "this", "that",
  "these", "those", "there", "their", "they", "what", "which", "who",
  "how", "when", "where", "why", "any", "all", "some", "such", "no",
  "more", "my", "your", "our", "his", "her",
  "docs", "doc", "documentation",
]);

const INDEX_STRIP_CHARS = `.,!?;:"'()[]`;
const SCORE_STRIP_CHARS = `.,!?;:"'()[]<>/`;

function stripChars(value: string, chars: string): string {
  const charset = new Set(chars.split(""));
  let start = 0;
  let end = value.length;
  while (start < end && charset.has(value[start])) start += 1;
  while (end > start && charset.has(value[end - 1])) end -= 1;
  return value.slice(start, end);
}

export interface DocumentRecord {
  filename: string;
  text: string;
}

export interface ChunkRecord {
  filename: string;
  text: string;
}

export interface ScoredSnippet {
  filename: string;
  text: string;
  score: number;
}

export function tokenizeLowerWords(text: string): string[] {
  return text.toLowerCase().match(/\S+/g) ?? [];
}

export function chunkDocuments(documents: DocumentRecord[]): ChunkRecord[] {
  const chunks: ChunkRecord[] = [];
  for (const { filename, text } of documents) {
    const paragraphs = text.split("\n\n");
    for (const para of paragraphs) {
      const stripped = para.trim();
      if (stripped) chunks.push({ filename, text: stripped });
    }
  }
  return chunks;
}

export function buildIndex(chunks: ChunkRecord[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (let i = 0; i < chunks.length; i += 1) {
    const text = chunks[i].text;
    for (const raw of tokenizeLowerWords(text)) {
      const token = stripChars(raw, INDEX_STRIP_CHARS);
      if (!token) continue;
      let list = index.get(token);
      if (!list) {
        list = [];
        index.set(token, list);
      }
      if (!list.includes(i)) list.push(i);
    }
  }
  return index;
}

export function scoreDocument(query: string, text: string): number {
  const textLower = text.toLowerCase();
  const contentWords = tokenizeLowerWords(query)
    .map((w) => stripChars(w, SCORE_STRIP_CHARS))
    .filter((w) => w && !STOP_WORDS.has(w));
  if (contentWords.length === 0) return 0;
  let score = 0;
  for (const word of contentWords) {
    if (textLower.includes(word)) score += 1;
  }
  return score;
}

const MIN_SCORE = 1;

export function retrieve(
  query: string,
  chunks: ChunkRecord[],
  index: Map<string, number[]>,
  topK = 3,
): ScoredSnippet[] {
  const queryTokens = tokenizeLowerWords(query)
    .map((t) => stripChars(t, SCORE_STRIP_CHARS))
    .filter((t) => t && !STOP_WORDS.has(t));

  const candidateIndices = new Set<number>();
  for (const token of queryTokens) {
    const hits = index.get(token);
    if (hits) for (const i of hits) candidateIndices.add(i);
  }

  const scored: { score: number; index: number; filename: string; text: string }[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    if (!candidateIndices.has(i)) continue;
    const { filename, text } = chunks[i];
    const score = scoreDocument(query, text);
    if (score >= MIN_SCORE) scored.push({ score, index: i, filename, text });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return scored.slice(0, topK).map(({ score, filename, text }) => ({ filename, text, score }));
}

export function loadDocumentsFromDir(docsFolder: string): DocumentRecord[] {
  const names = fs
    .readdirSync(docsFolder)
    .filter((n) => n.endsWith(".md") || n.endsWith(".txt"))
    .sort((a, b) => a.localeCompare(b));
  const docs: DocumentRecord[] = [];
  for (const filename of names) {
    const full = path.join(docsFolder, filename);
    const text = fs.readFileSync(full, "utf8");
    docs.push({ filename, text });
  }
  return docs;
}

export function buildRetriever(docsFolder: string): {
  chunks: ChunkRecord[];
  index: Map<string, number[]>;
  retrieve: (query: string, topK?: number) => ScoredSnippet[];
} {
  const documents = loadDocumentsFromDir(docsFolder);
  const chunks = chunkDocuments(documents);
  const index = buildIndex(chunks);
  return {
    chunks,
    index,
    retrieve: (query: string, topK = 3) => retrieve(query, chunks, index, topK),
  };
}

export function defaultDocsPath(): string {
  return path.join(process.cwd(), "content", "docs");
}
