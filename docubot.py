"""
Core DocuBot class responsible for:
- Loading documents from the docs/ folder
- Building a simple retrieval index (Phase 1)
- Retrieving relevant snippets (Phase 1)
- Supporting retrieval only answers
- Supporting RAG answers when paired with Gemini (Phase 2)
"""

import os
import glob

class DocuBot:
    def __init__(self, docs_folder="docs", llm_client=None):
        """
        docs_folder: directory containing project documentation files
        llm_client: optional Gemini client for LLM based answers
        """
        self.docs_folder = docs_folder
        self.llm_client = llm_client

        # Load documents into memory
        self.documents = self.load_documents()  # List of (filename, full_text)

        # Split documents into paragraph-level chunks for finer retrieval
        self.chunks = self.chunk_documents(self.documents)  # List of (filename, chunk_text)

        # Build a retrieval index over chunks
        self.index = self.build_index(self.chunks)

    # -----------------------------------------------------------
    # Document Loading
    # -----------------------------------------------------------

    def load_documents(self):
        """
        Loads all .md and .txt files inside docs_folder.
        Returns a list of tuples: (filename, text)
        """
        docs = []
        pattern = os.path.join(self.docs_folder, "*.*")
        for path in glob.glob(pattern):
            if path.endswith(".md") or path.endswith(".txt"):
                with open(path, "r", encoding="utf8") as f:
                    text = f.read()
                filename = os.path.basename(path)
                docs.append((filename, text))
        return docs

    def chunk_documents(self, documents):
        """
        Splits each document into paragraph-level chunks (split on blank lines).
        Returns a flat list of (filename, chunk_text) tuples.
        Skips empty or whitespace-only paragraphs.
        """
        chunks = []
        for filename, text in documents:
            paragraphs = text.split("\n\n")
            for para in paragraphs:
                stripped = para.strip()
                if stripped:
                    chunks.append((filename, stripped))
        return chunks

    # -----------------------------------------------------------
    # Index Construction (Phase 1)
    # -----------------------------------------------------------

    def build_index(self, documents):
        """
        TODO (Phase 1):
        Build a tiny inverted index mapping lowercase words to the documents
        they appear in.

        Example structure:
        {
            "token": ["AUTH.md", "API_REFERENCE.md"],
            "database": ["DATABASE.md"]
        }

        Keep this simple: split on whitespace, lowercase tokens,
        ignore punctuation if needed.
        """
        index = {}
        for i, (_, text) in enumerate(documents):
            for token in text.lower().split():
                token = token.strip(".,!?;:\"'()[]")
                if token:
                    if token not in index:
                        index[token] = []
                    if i not in index[token]:
                        index[token].append(i)
        return index

    # -----------------------------------------------------------
    # Scoring and Retrieval (Phase 1)
    # -----------------------------------------------------------

    # Common words that appear everywhere and carry no signal
    STOP_WORDS = {
        "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "can", "of", "in", "on", "at",
        "to", "for", "with", "by", "from", "up", "about", "into", "through",
        "and", "or", "but", "not", "if", "as", "it", "its", "this", "that",
        "these", "those", "there", "their", "they", "what", "which", "who",
        "how", "when", "where", "why", "any", "all", "some", "such", "no",
        "more", "my", "your", "our", "his", "her",
        # Domain-specific generics: every result is a "doc", so these carry no signal
        "docs", "doc", "documentation",
    }

    def score_document(self, query, text):
        """
        Return a relevance score based on how many meaningful query words appear
        in the text. Stop words are excluded so common words don't inflate scores.
        """
        text_lower = text.lower()
        content_words = [
            w.strip(".,!?;:\"'()[]<>/") for w in query.lower().split()
            if w.strip(".,!?;:\"'()[]<>/") not in self.STOP_WORDS
            and w.strip(".,!?;:\"'()[]<>/")
        ]
        if not content_words:
            return 0
        score = sum(1 for word in content_words if word in text_lower)
        return score

    def retrieve(self, query, top_k=3):
        """
        TODO (Phase 1):
        Use the index and scoring function to select top_k relevant document snippets.

        Return a list of (filename, text) sorted by score descending.
        """
        # Minimum score a chunk must reach to be considered meaningful evidence.
        # Score is based on content words only (stop words excluded), so even
        # score=1 means at least one meaningful term matched.
        MIN_SCORE = 1

        # Use only content words to look up candidate chunks in the index
        query_tokens = [
            t.strip(".,!?;:\"'()[]<>/") for t in query.lower().split()
            if t.strip(".,!?;:\"'()[]<>/") not in self.STOP_WORDS
            and t.strip(".,!?;:\"'()[]<>/")
        ]
        candidate_indices = set()
        for token in query_tokens:
            if token in self.index:
                candidate_indices.update(self.index[token])

        # Score each candidate chunk; apply guardrail threshold
        scored = []
        for i, (filename, text) in enumerate(self.chunks):
            if i in candidate_indices:
                score = self.score_document(query, text)
                if score >= MIN_SCORE:
                    scored.append((score, filename, text))

        scored.sort(key=lambda x: x[0], reverse=True)
        results = [(filename, text) for _, filename, text in scored]
        return results[:top_k]

    # -----------------------------------------------------------
    # Answering Modes
    # -----------------------------------------------------------

    def answer_retrieval_only(self, query, top_k=3):
        """
        Phase 1 retrieval only mode.
        Returns raw snippets and filenames with no LLM involved.
        """
        snippets = self.retrieve(query, top_k=top_k)

        if not snippets:
            return "I do not know based on these docs."

        formatted = []
        for filename, text in snippets:
            formatted.append(f"[{filename}]\n{text}\n")

        return "\n---\n".join(formatted)

    def answer_rag(self, query, top_k=3):
        """
        Phase 2 RAG mode.
        Uses student retrieval to select snippets, then asks Gemini
        to generate an answer using only those snippets.
        """
        if self.llm_client is None:
            raise RuntimeError(
                "RAG mode requires an LLM client. Provide a GeminiClient instance."
            )

        snippets = self.retrieve(query, top_k=top_k)

        if not snippets:
            return "I do not know based on these docs."

        return self.llm_client.answer_from_snippets(query, snippets)

    # -----------------------------------------------------------
    # Bonus Helper: concatenated docs for naive generation mode
    # -----------------------------------------------------------

    def full_corpus_text(self):
        """
        Returns all documents concatenated into a single string.
        This is used in Phase 0 for naive 'generation only' baselines.
        """
        return "\n\n".join(text for _, text in self.documents)
