"""
Automated checks for DocuBot retrieval (no API key, deterministic).

These mirror the golden cases in web/src/lib/retrieval.test.ts so Python
and TypeScript retrieval stay aligned on the bundled corpus.
"""

from pathlib import Path

import pytest

from docubot import DocuBot
from evaluation import evaluate_retrieval

ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"


@pytest.fixture
def bot() -> DocuBot:
    return DocuBot(docs_folder=str(DOCS_DIR))


def test_retrieve_includes_auth_for_token_question(bot: DocuBot) -> None:
    results = bot.retrieve("Where is the auth token generated?", top_k=5)
    files = [fname for fname, _ in results]
    assert "AUTH.md" in files
    assert results


def test_retrieve_includes_database_for_users_table(bot: DocuBot) -> None:
    results = bot.retrieve("Which fields are stored in the users table?", top_k=5)
    files = [fname for fname, _ in results]
    assert "DATABASE.md" in files


def test_retrieve_empty_for_off_topic_payment_question(bot: DocuBot) -> None:
    results = bot.retrieve(
        "Is there any mention of payment processing in these docs?",
        top_k=5,
    )
    assert results == []


def test_answer_retrieval_only_unknown_when_no_hits(bot: DocuBot) -> None:
    answer = bot.answer_retrieval_only(
        "Is there any mention of payment processing in these docs?",
        top_k=3,
    )
    assert "do not know" in answer.lower()


def test_evaluate_retrieval_hit_rate_above_floor(bot: DocuBot) -> None:
    """Harness from evaluation.py; guards against accidental regressions."""
    hit_rate, rows = evaluate_retrieval(bot, top_k=3)
    assert hit_rate >= 0.5
    assert len(rows) >= 1
    assert all("query" in r and "hit" in r for r in rows)
