"""Apply the officer -> worker role migration.

Reads backend/migrations/002_officer_to_worker.sql and executes each
PostgreSQL statement separately. asyncpg rejects running the whole file as a
single prepared statement ("cannot insert multiple commands into a prepared
statement"), so statements are split with a PostgreSQL-aware parser that keeps
DO $$ ... END $$ blocks (and their internal semicolons) intact.

Idempotent: safe to run multiple times. No tables/users are dropped or truncated.

Run from the project root (where .env lives):
    python backend/migrations/apply_migration.py
"""
import asyncio
import re
import sys
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[2]  # project root (holds .env)
sys.path.insert(0, str(ROOT / "backend"))

from app.database import engine  # noqa: E402

MIGRATION_SQL_FILE = Path(__file__).resolve().parent / "002_officer_to_worker.sql"


def _is_dollar_tag(tag: str) -> bool:
    """Accept tags of the form $$, $tag$ where tag is [A-Za-z0-9_]*."""
    if len(tag) < 2 or tag[0] != "$" or tag[-1] != "$":
        return False
    body = tag[1:-1]
    if not body:
        return True
    return bool(re.fullmatch(r"[A-Za-z0-9_]+", body))


def split_sql_statements(sql: str) -> list[str]:
    """Split SQL on top-level semicolons.

    Tracks dollar-quoted bodies ($tag$ ... $tag$, e.g. DO $$ ... $$ ), single
    quoted strings ('...' with '' escape), line comments (--) and block
    comments (/* ... */) so semicolons inside them never split statements.
    """
    statements: list[str] = []
    buf: list[str] = []
    n = len(sql)
    i = 0
    state = "normal"  # normal | single_quote | dollar | line_comment | block_comment
    dollar_tag: str | None = None

    def flush():
        stmt = "".join(buf).strip()
        if stmt:
            statements.append(stmt)
        buf.clear()

    while i < n:
        c = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ""

        if state == "normal":
            if c == "-" and nxt == "-":
                state = "line_comment"
                buf.append("--")
                i += 2
                continue
            if c == "/" and nxt == "*":
                state = "block_comment"
                buf.append("/*")
                i += 2
                continue
            if c == "'":
                state = "single_quote"
                buf.append(c)
                i += 1
                continue
            if c == "$":
                end = sql.find("$", i + 1)
                if end != -1:
                    tag = sql[i : end + 1]
                    if _is_dollar_tag(tag):
                        state = "dollar"
                        dollar_tag = tag
                        buf.append(tag)
                        i += len(tag)
                        continue
            if c == ";":
                flush()
                i += 1
                continue
            buf.append(c)
            i += 1
            continue

        if state == "single_quote":
            if c == "'":
                if nxt == "'":  # escaped quote ''
                    buf.append("''")
                    i += 2
                    continue
                state = "normal"
                buf.append(c)
                i += 1
                continue
            buf.append(c)
            i += 1
            continue

        if state == "line_comment":
            if c == "\n":
                state = "normal"
                buf.append(c)
                i += 1
                continue
            buf.append(c)
            i += 1
            continue

        if state == "block_comment":
            if c == "*" and nxt == "/":
                state = "normal"
                buf.append("*/")
                i += 2
                continue
            buf.append(c)
            i += 1
            continue

        if state == "dollar":
            if c == "$" and sql.startswith(dollar_tag, i):
                buf.append(dollar_tag)
                i += len(dollar_tag)
                state = "normal"
                continue
            buf.append(c)
            i += 1
            continue

    flush()
    return statements


def load_migration_statements() -> list[str]:
    raw = MIGRATION_SQL_FILE.read_text(encoding="utf-8")
    # Remove the psql-only transaction wrappers (unneeded and invalid inside an
    # already-open SQLAlchemy transaction).
    raw = re.sub(r"(?im)^\s*BEGIN\s*;\s*$", "", raw)
    raw = re.sub(r"(?im)^\s*COMMIT\s*;\s*$", "", raw)
    return split_sql_statements(raw)


async def main() -> None:
    statements = load_migration_statements()
    print(f"Executing {len(statements)} migration statements in one transaction...")
    async with engine.begin() as conn:
        for idx, stmt in enumerate(statements, start=1):
            first_line = stmt.strip().splitlines()[0][:60] if stmt.strip() else ""
            print(f"  [{idx}/{len(statements)}] {first_line}")
            await conn.execute(text(stmt))
    print("Migration applied successfully. roles now admin|worker; specialization type renamed to workerspecialization.")


if __name__ == "__main__":
    asyncio.run(main())