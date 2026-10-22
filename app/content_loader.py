"""Load the course catalog and per-lesson content from the ``lessons/`` tree.

Layout::

    lessons/catalog.json                 # authoritative ordered outline
    lessons/<chapter>/<lesson>/lesson.json
    lessons/<chapter>/<lesson>/content.html
    lessons/<chapter>/<lesson>/quiz.json

The catalog is authoritative so the outline can be shown (\"first list all the
lessons\") before every lesson has been authored.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

_SAFE = re.compile(r"^[A-Za-z0-9._-]+$")


class ContentLoader:
    def __init__(self, resource_root: Path):
        self.root = Path(resource_root)
        self.lessons_dir = self.root / "lessons"

    # -- helpers -----------------------------------------------------------
    @staticmethod
    def _read_json(path: Path):
        return json.loads(path.read_text(encoding="utf-8"))

    def _safe_segment(self, seg: str) -> bool:
        return bool(seg) and bool(_SAFE.match(seg)) and ".." not in seg

    def lesson_dir(self, chapter: str, lesson_id: str) -> Path | None:
        if not (self._safe_segment(chapter) and self._safe_segment(lesson_id)):
            return None
        return self.lessons_dir / chapter / lesson_id

    # -- public API --------------------------------------------------------
    def catalog(self) -> list[dict]:
        """Return chapters with lessons annotated with ``hasContent``."""
        data = self._read_json(self.lessons_dir / "catalog.json")
        chapters = []
        for ch in data["chapters"]:
            lessons = []
            for ls in ch["lessons"]:
                d = self.lessons_dir / ch["id"] / ls["id"]
                lessons.append(
                    {
                        "id": ls["id"],
                        "order": ls["order"],
                        "title": ls["title"],
                        "tags": list(ls.get("tags") or []),
                        "chapter": ch["id"],
                        "chapterTitle": ch["title"],
                        "hasContent": (d / "lesson.json").is_file(),
                    }
                )
            chapters.append({"id": ch["id"], "title": ch["title"], "lessons": lessons})
        return chapters

    def lesson(self, chapter: str, lesson_id: str) -> dict | None:
        d = self.lesson_dir(chapter, lesson_id)
        if d is None or not (d / "lesson.json").is_file():
            return None
        meta = self._read_json(d / "lesson.json")
        content = ""
        cpath = d / "content.html"
        if cpath.is_file():
            content = cpath.read_text(encoding="utf-8")
        quiz_path = d / "quiz.json"
        quiz = self._read_json(quiz_path) if quiz_path.is_file() else {"choice": [], "code": []}
        quiz.setdefault("choice", [])
        quiz.setdefault("code", [])
        return {"meta": meta, "content": content, "quiz": quiz}
