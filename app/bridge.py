"""QWebChannel API exposed to the front end as ``window.bridge``.

Every slot returns a JSON **string** so the JavaScript side can ``JSON.parse``
it; Qt WebChannel resolves the return value of a slot synchronously when it has
a ``result`` type.  Long-running work (judging) is not done here - it is
delegated to :class:`app.judge.launcher.JudgeLauncher`, whose events are
re-emitted as Qt signals that the JS side subscribes to.
"""

from __future__ import annotations

import json
import os
from datetime import datetime

from PySide6.QtCore import QObject, Signal, Slot

from .content_loader import ContentLoader
from .judge.launcher import JudgeLauncher
from .progress import ProgressStore


def _dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False)


class AppBridge(QObject):
    # judge lifecycle, payloads are JSON strings
    judgeStarted = Signal(str)
    judgeEvent = Signal(str)
    judgeFinished = Signal(str)
    judgeFailed = Signal(str)
    toast = Signal(str)

    def __init__(
        self,
        loader: ContentLoader,
        store: ProgressStore,
        launcher: JudgeLauncher,
        app_root: str,
        var_dir: str,
        version: str,
        parent=None,
    ):
        super().__init__(parent)
        self._loader = loader
        self._store = store
        self._launcher = launcher
        self._app_root = app_root
        self._var_dir = var_dir
        self._version = version
        self._judge_ctx: dict = {}

        launcher.started.connect(lambda o: self.judgeStarted.emit(_dumps(o)))
        launcher.event.connect(lambda o: self.judgeEvent.emit(_dumps(o)))
        launcher.failed.connect(self.judgeFailed.emit)
        launcher.finished.connect(self._on_judge_finished)

    # -- app info ----------------------------------------------------------
    @Slot(result=str)
    def appInfo(self) -> str:
        return _dumps(
            {
                "version": self._version,
                "appRoot": self._app_root,
                "varDir": self._var_dir,
                "problemsDir": os.path.join(self._app_root, "app", "judge", "problems"),
            }
        )

    # -- content -----------------------------------------------------------
    @Slot(result=str)
    def catalog(self) -> str:
        try:
            return _dumps({"ok": True, "chapters": self._loader.catalog()})
        except Exception as exc:  # noqa: BLE001
            return _dumps({"ok": False, "error": str(exc), "chapters": []})

    @Slot(str, str, result=str)
    def lesson(self, chapter: str, lesson_id: str) -> str:
        try:
            data = self._loader.lesson(chapter, lesson_id)
        except Exception as exc:  # noqa: BLE001
            return _dumps({"ok": False, "error": str(exc)})
        if data is None:
            return _dumps({"ok": False, "error": "该课节内容尚未编写", "missing": True})
        return _dumps({"ok": True, **data})

    # -- progress ----------------------------------------------------------
    @Slot(result=str)
    def progressSummary(self) -> str:
        return _dumps({"ok": True, "summary": self._store.summary()})

    @Slot(str, result=str)
    def lessonState(self, lesson_id: str) -> str:
        return _dumps({"ok": True, "state": self._store.lesson_state(lesson_id)})

    @Slot(str, str, result=str)
    def setStatus(self, lesson_id: str, status: str) -> str:
        self._store.set_status(lesson_id, status)
        return _dumps({"ok": True})

    @Slot(str, result=str)
    def markDone(self, lesson_id: str) -> str:
        self._store.mark_done(lesson_id)
        return _dumps({"ok": True, "summary": self._store.summary()})

    @Slot(str, result=str)
    def resetLesson(self, lesson_id: str) -> str:
        self._store.reset_lesson(lesson_id)
        return _dumps({"ok": True, "summary": self._store.summary()})

    @Slot(str, int, int, bool, result=str)
    def answerChoice(self, lesson_id: str, q_index: int, chosen: int, correct: bool) -> str:
        state = self._store.set_choice(lesson_id, q_index, chosen, correct)
        return _dumps({"ok": True, "state": state})

    @Slot(str, float, result=str)
    def setChoiceScore(self, lesson_id: str, fraction: float) -> str:
        self._store.set_choice_score(lesson_id, fraction)
        return _dumps({"ok": True, "summary": self._store.summary()})

    @Slot(str, str, str, str, result=str)
    def saveDraft(self, lesson_id: str, problem_id: str, language: str, code: str) -> str:
        self._store.save_draft(lesson_id, problem_id, language, code)
        return _dumps({"ok": True})

    @Slot(str, str, result=str)
    def saveNote(self, lesson_id: str, text: str) -> str:
        self._store.save_note(lesson_id, text)
        return _dumps({"ok": True})

    # -- wrong book --------------------------------------------------------
    @Slot(result=str)
    def wrongList(self) -> str:
        return _dumps({"ok": True, "items": self._store.wrong_list()})

    @Slot(str, int, str, str, str, result=str)
    def addWrong(self, lesson_id: str, q_index: int, kind: str, prompt: str, detail: str) -> str:
        self._store.add_wrong(lesson_id, q_index, kind, prompt, detail)
        return _dumps({"ok": True})

    @Slot(str, int, str, result=str)
    def clearWrong(self, lesson_id: str, q_index: int, kind: str) -> str:
        self._store.clear_wrong(lesson_id, q_index, kind)
        return _dumps({"ok": True})

    # -- judging -----------------------------------------------------------
    @Slot(str, str, str, result=str)
    def judgeRun(self, lesson_id: str, problem_id: str, code: str) -> str:
        if self._launcher.is_running():
            return _dumps({"ok": False, "error": "已有判题在运行"})
        self._judge_ctx = {"lesson_id": lesson_id, "problem_id": problem_id}
        ok = self._launcher.run(problem_id, code)
        return _dumps({"ok": bool(ok)})

    @Slot(result=str)
    def judgeCancel(self) -> str:
        self._launcher.cancel()
        return _dumps({"ok": True})

    def _on_judge_finished(self, payload: dict) -> None:
        ctx = self._judge_ctx or {}
        try:
            self._store.add_judge(
                ctx.get("lesson_id", ""),
                ctx.get("problem_id", ""),
                str(payload.get("verdict", "")),
                str(payload.get("summary", ""))[:500],
            )
        except Exception:  # noqa: BLE001
            pass
        self.judgeFinished.emit(_dumps(payload))
        self._judge_ctx = {}

    # -- backup ------------------------------------------------------------
    @Slot(result=str)
    def exportProgress(self) -> str:
        try:
            out_dir = os.path.join(self._var_dir, "backup")
            os.makedirs(out_dir, exist_ok=True)
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            path = os.path.join(out_dir, f"progress_{stamp}.json")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(self._store.export_json())
            return _dumps({"ok": True, "path": path})
        except Exception as exc:  # noqa: BLE001
            return _dumps({"ok": False, "error": str(exc)})

    @Slot(result=str)
    def exportProgressJson(self) -> str:
        return _dumps({"ok": True, "json": self._store.export_json()})

    @Slot(str, result=str)
    def importProgress(self, payload_json: str) -> str:
        try:
            payload = json.loads(payload_json)
            self._store.import_all(payload)
            return _dumps({"ok": True, "summary": self._store.summary()})
        except Exception as exc:  # noqa: BLE001
            return _dumps({"ok": False, "error": str(exc)})
