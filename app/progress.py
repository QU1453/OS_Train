"""SQLite persistence: progress, choice answers, code drafts, notes, wrong book.

A single file ``var/progress.db`` holds everything so progress survives restarts
and can be exported/imported as JSON for backup.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime
from pathlib import Path

_SCHEMA = """
CREATE TABLE IF NOT EXISTS lesson_progress (
    lesson_id   TEXT PRIMARY KEY,
    status      TEXT NOT NULL DEFAULT 'unseen',
    best_choice REAL NOT NULL DEFAULT 0,
    updated     TEXT
);
CREATE TABLE IF NOT EXISTS choice_answers (
    lesson_id TEXT NOT NULL,
    q_index   INTEGER NOT NULL,
    chosen    INTEGER,
    correct   INTEGER NOT NULL DEFAULT 0,
    updated   TEXT,
    PRIMARY KEY (lesson_id, q_index)
);
CREATE TABLE IF NOT EXISTS code_drafts (
    lesson_id  TEXT NOT NULL,
    problem_id TEXT NOT NULL,
    language   TEXT NOT NULL,
    code       TEXT NOT NULL DEFAULT '',
    updated    TEXT,
    PRIMARY KEY (lesson_id, problem_id, language)
);
CREATE TABLE IF NOT EXISTS notes (
    lesson_id TEXT PRIMARY KEY,
    text      TEXT NOT NULL DEFAULT '',
    updated   TEXT
);
CREATE TABLE IF NOT EXISTS wrong_book (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id TEXT NOT NULL,
    q_index   INTEGER,
    kind      TEXT,
    prompt    TEXT,
    detail    TEXT,
    created   TEXT
);
CREATE TABLE IF NOT EXISTS judge_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id  TEXT,
    problem_id TEXT,
    verdict    TEXT,
    detail     TEXT,
    created    TEXT
);
"""


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


class ProgressStore:
    def __init__(self, db_path: Path):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.executescript(_SCHEMA)
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    # -- progress ----------------------------------------------------------
    def summary(self) -> dict:
        with self._lock:
            rows = self._conn.execute(
                "SELECT lesson_id, status, best_choice FROM lesson_progress"
            ).fetchall()
        return {
            r["lesson_id"]: {"status": r["status"], "bestChoice": r["best_choice"]}
            for r in rows
        }

    def _ensure_row(self, lesson_id: str) -> None:
        self._conn.execute(
            "INSERT OR IGNORE INTO lesson_progress (lesson_id, status, best_choice, updated)"
            " VALUES (?, 'unseen', 0, ?)",
            (lesson_id, _now()),
        )

    def set_status(self, lesson_id: str, status: str) -> None:
        with self._lock:
            self._ensure_row(lesson_id)
            self._conn.execute(
                "UPDATE lesson_progress SET status=?, updated=? WHERE lesson_id=?",
                (status, _now(), lesson_id),
            )
            self._conn.commit()

    # -- lesson state ------------------------------------------------------
    def lesson_state(self, lesson_id: str) -> dict:
        with self._lock:
            choices = {
                str(r["q_index"]): {"chosen": r["chosen"], "correct": bool(r["correct"])}
                for r in self._conn.execute(
                    "SELECT q_index, chosen, correct FROM choice_answers WHERE lesson_id=?",
                    (lesson_id,),
                )
            }
            drafts: dict = {}
            for r in self._conn.execute(
                "SELECT problem_id, language, code FROM code_drafts WHERE lesson_id=?",
                (lesson_id,),
            ):
                drafts.setdefault(r["problem_id"], {})[r["language"]] = r["code"]
            note_row = self._conn.execute(
                "SELECT text FROM notes WHERE lesson_id=?", (lesson_id,)
            ).fetchone()
        return {
            "lessonId": lesson_id,
            "choices": choices,
            "drafts": drafts,
            "note": note_row["text"] if note_row else "",
        }

    def set_choice(self, lesson_id: str, q_index: int, chosen: int, correct: bool) -> dict:
        with self._lock:
            self._ensure_row(lesson_id)
            self._conn.execute(
                "INSERT INTO choice_answers (lesson_id, q_index, chosen, correct, updated)"
                " VALUES (?,?,?,?,?)"
                " ON CONFLICT(lesson_id, q_index) DO UPDATE SET"
                " chosen=excluded.chosen, correct=excluded.correct, updated=excluded.updated",
                (lesson_id, q_index, chosen, 1 if correct else 0, _now()),
            )
            self._conn.commit()
        self._refresh_status(lesson_id)
        return self.lesson_state(lesson_id)

    def save_draft(self, lesson_id: str, problem_id: str, language: str, code: str) -> None:
        with self._lock:
            self._ensure_row(lesson_id)
            self._conn.execute(
                "INSERT INTO code_drafts (lesson_id, problem_id, language, code, updated)"
                " VALUES (?,?,?,?,?)"
                " ON CONFLICT(lesson_id, problem_id, language) DO UPDATE SET"
                " code=excluded.code, updated=excluded.updated",
                (lesson_id, problem_id, language, code, _now()),
            )
            self._conn.commit()
        self._refresh_status(lesson_id)

    def save_note(self, lesson_id: str, text: str) -> None:
        with self._lock:
            self._ensure_row(lesson_id)
            self._conn.execute(
                "INSERT INTO notes (lesson_id, text, updated) VALUES (?,?,?)"
                " ON CONFLICT(lesson_id) DO UPDATE SET text=excluded.text, updated=excluded.updated",
                (lesson_id, text, _now()),
            )
            self._conn.commit()

    def _refresh_status(self, lesson_id: str) -> None:
        """Mark a lesson as in_progress once the learner interacts with it."""
        with self._lock:
            self._ensure_row(lesson_id)
            row = self._conn.execute(
                "SELECT status FROM lesson_progress WHERE lesson_id=?", (lesson_id,)
            ).fetchone()
            if row and row["status"] == "unseen":
                self._conn.execute(
                    "UPDATE lesson_progress SET status='in_progress', updated=? WHERE lesson_id=?",
                    (_now(), lesson_id),
                )
                self._conn.commit()

    def set_choice_score(self, lesson_id: str, fraction: float) -> None:
        with self._lock:
            self._ensure_row(lesson_id)
            self._conn.execute(
                "UPDATE lesson_progress SET best_choice=MAX(best_choice, ?), updated=?"
                " WHERE lesson_id=?",
                (float(fraction), _now(), lesson_id),
            )
            self._conn.commit()

    def mark_done(self, lesson_id: str) -> None:
        self.set_status(lesson_id, "done")

    def reset_lesson(self, lesson_id: str) -> None:
        with self._lock:
            for t in ("lesson_progress", "choice_answers", "code_drafts", "notes"):
                self._conn.execute(f"DELETE FROM {t} WHERE lesson_id=?", (lesson_id,))
            self._conn.commit()

    # -- wrong book --------------------------------------------------------
    def add_wrong(self, lesson_id: str, q_index: int, kind: str, prompt: str, detail: str) -> None:
        with self._lock:
            self._conn.execute(
                "DELETE FROM wrong_book WHERE lesson_id=? AND q_index=? AND kind=?",
                (lesson_id, q_index, kind),
            )
            self._conn.execute(
                "INSERT INTO wrong_book (lesson_id, q_index, kind, prompt, detail, created)"
                " VALUES (?,?,?,?,?,?)",
                (lesson_id, q_index, kind, prompt, detail, _now()),
            )
            self._conn.commit()

    def clear_wrong(self, lesson_id: str, q_index: int, kind: str) -> None:
        with self._lock:
            self._conn.execute(
                "DELETE FROM wrong_book WHERE lesson_id=? AND q_index=? AND kind=?",
                (lesson_id, q_index, kind),
            )
            self._conn.commit()

    def wrong_list(self) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM wrong_book ORDER BY created DESC"
            ).fetchall()
        return [dict(r) for r in rows]

    # -- judge history -----------------------------------------------------
    def add_judge(self, lesson_id: str, problem_id: str, verdict: str, detail: str) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO judge_history (lesson_id, problem_id, verdict, detail, created)"
                " VALUES (?,?,?,?,?)",
                (lesson_id, problem_id, verdict, detail, _now()),
            )
            self._conn.commit()

    # -- backup ------------------------------------------------------------
    def export_all(self) -> dict:
        with self._lock:
            data = {}
            for table in (
                "lesson_progress",
                "choice_answers",
                "code_drafts",
                "notes",
                "wrong_book",
                "judge_history",
            ):
                rows = self._conn.execute(f"SELECT * FROM {table}").fetchall()
                data[table] = [dict(r) for r in rows]
        return {"app": "OS_Train", "version": 1, "exported": _now(), "tables": data}

    def import_all(self, payload: dict) -> None:
        tables = payload.get("tables") or {}
        with self._lock:
            for table, rows in tables.items():
                if table not in {
                    "lesson_progress",
                    "choice_answers",
                    "code_drafts",
                    "notes",
                    "wrong_book",
                    "judge_history",
                }:
                    continue
                if not rows:
                    continue
                cols = list(rows[0].keys())
                placeholders = ",".join("?" for _ in cols)
                collist = ",".join(cols)
                for row in rows:
                    self._conn.execute(
                        f"INSERT OR REPLACE INTO {table} ({collist}) VALUES ({placeholders})",
                        [row.get(c) for c in cols],
                    )
            self._conn.commit()

    def export_json(self) -> str:
        return json.dumps(self.export_all(), ensure_ascii=False, indent=2)
