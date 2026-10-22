"""Parent-side judge launcher built on :class:`QProcess`.

Responsibilities:

* write the student's code to a scratch file under ``var/judge_tmp``
* spawn ``--judge`` and stream its JSON-line protocol to the GUI
* enforce a wall-clock timeout by killing the process (tree) on expiry
* confine the child in a Win32 Job Object (memory cap + no orphans)
"""

from __future__ import annotations

import json
import os

from PySide6.QtCore import QObject, QProcess, QTimer, Signal

from . import build_command, problem_spec_path
from .sandbox import WindowsJob, cleanup_temp_dir, make_temp_dir


class JudgeLauncher(QObject):
    """Runs at most one judge process at a time and reports its events."""

    started = Signal(dict)      # {"problem","kind","title"}
    event = Signal(dict)        # every parsed protocol line
    finished = Signal(dict)     # the final {"type":"done", ...} payload
    failed = Signal(str)        # launcher-level failure (could not start, timeout)

    def __init__(self, app_root: str, var_dir: str, frozen: bool = False, parent=None):
        super().__init__(parent)
        self._app_root = app_root
        self._var_dir = var_dir
        self._frozen = frozen
        self._proc: QProcess | None = None
        self._buf = ""
        self._tmp_dir: str | None = None
        self._done: dict | None = None
        self._settled = False
        self._cancel_requested = False
        self._job = WindowsJob(memory_limit_mb=512)
        self._timer = QTimer(self)
        self._timer.setSingleShot(True)
        self._timer.timeout.connect(self._on_timeout)
        self._timeout_sec = 30.0

        # 无输出看门狗：子进程若长时间不吐一行 JSON，几乎必然是死循环或永久等待。
        # 老版本只在「总超时」时才收尾，遇到 sleep/卡死的用户代码会让界面长期停在
        # 「正在编译并运行……」，因此这里补一个更短的空闲超时。
        self._stall = QTimer(self)
        self._stall.setSingleShot(True)
        self._stall.timeout.connect(self._on_stall)
        self._stall_ms = 12000

        # 最终兜底：总超时之外再多给 6 秒，无论如何强制收尾，保证界面一定解锁。
        self._guard = QTimer(self)
        self._guard.setSingleShot(True)
        self._guard.timeout.connect(self._on_guard)

    # -- public API --------------------------------------------------------
    def is_running(self) -> bool:
        return self._proc is not None and self._proc.state() != QProcess.NotRunning

    def run(self, problem_id: str, code: str, total_timeout_sec: float | None = None) -> bool:
        if self.is_running():
            self.failed.emit("已有判题进程在运行，请先停止。")
            return False
        if self._proc is not None:  # 回收上一轮已结束的 QProcess
            self._proc.deleteLater()
            self._proc = None
        try:
            spec_path = problem_spec_path(self._app_root, problem_id)
        except ValueError as exc:
            self.failed.emit(str(exc))
            return False
        if not os.path.isfile(spec_path):
            self.failed.emit(f"找不到题目判题规格：{problem_id}")
            return False

        self._timeout_sec = float(total_timeout_sec or self._read_timeout(spec_path))

        self._cleanup_tmp()
        self._tmp_dir = make_temp_dir(self._var_dir)
        solution_path = os.path.join(self._tmp_dir, "solution.py")
        with open(solution_path, "w", encoding="utf-8") as fh:
            fh.write(code or "")
        spec_copy = os.path.join(self._tmp_dir, "spec.json")
        try:
            with open(spec_copy, "wb") as dst, open(spec_path, "rb") as src:
                dst.write(src.read())
        except OSError:
            spec_copy = spec_path

        cmd = build_command(self._app_root, self._frozen, spec_copy, solution_path)
        proc = QProcess(self)
        proc.setProgram(cmd[0])
        proc.setArguments(cmd[1:])
        proc.setWorkingDirectory(self._app_root)
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        env["TMP"] = env["TEMP"] = os.path.join(self._var_dir, "tmp")
        proc.setProcessEnvironment(_to_qenv(env))
        proc.setProcessChannelMode(QProcess.SeparateChannels)
        proc.readyReadStandardOutput.connect(self._on_stdout)
        proc.finished.connect(self._on_finished)
        proc.errorOccurred.connect(self._on_error)

        self._proc = proc
        self._buf = ""
        self._done = None
        self._settled = False
        self._cancel_requested = False
        self._timer.stop()
        self._stall.stop()
        self._guard.stop()
        proc.start()
        if not proc.waitForStarted(5000):
            self._proc = None
            self.failed.emit("判题进程启动失败。")
            return False

        if self._job.available:
            self._job.assign(int(proc.processId()))
        self._timer.start(int(self._timeout_sec * 1000))
        self._stall.start(self._stall_ms)
        self._guard.start(int((self._timeout_sec + 6.0) * 1000))
        return True

    def cancel(self) -> None:
        """停止当前判题：非阻塞地结束进程树，并保证界面一定收到收尾信号。

        旧实现只在 ``QProcess.finished`` 里收尾，且用 ``waitForFinished`` 阻塞
        UI 线程；一旦进程已结束（或信号丢失），界面按钮就再也恢复不了。
        这里改为：立刻终结 Job / kill 进程（不等待），并在稍后兜底强制收尾。
        """
        self._timer.stop()
        self._stall.stop()
        self._guard.stop()
        self._cancel_requested = True
        alive = self._proc is not None and self._proc.state() != QProcess.NotRunning
        self._kill()
        if alive:
            # 子进程的 finished 通常几毫秒内到达；超时则强制收尾，绝不让界面卡住。
            QTimer.singleShot(400, self._settle_cancelled)
        else:
            self._settle_cancelled()

    # -- internals ---------------------------------------------------------
    @staticmethod
    def _read_timeout(spec_path: str) -> float:
        try:
            with open(spec_path, "r", encoding="utf-8") as fh:
                spec = json.load(fh)
        except Exception:  # noqa: BLE001
            return 30.0
        if "total_timeout_sec" in spec:
            return float(spec["total_timeout_sec"])
        if spec.get("kind") == "concurrency":
            runs = int(spec.get("runs", 15))
            per = float(spec.get("run_timeout_sec", 2.0))
            return runs * per + 12.0
        return 20.0

    def _on_stdout(self) -> None:
        if self._proc is None:
            return
        chunk = bytes(self._proc.readAllStandardOutput()).decode("utf-8", errors="replace")
        self._buf += chunk
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            self._stall.start(self._stall_ms)  # 有输出即视为存活，重置空闲计时
            if obj.get("type") == "start":
                self.started.emit(obj)
            elif obj.get("type") == "done":
                self._done = obj
            self.event.emit(obj)

    def _on_finished(self, code: int, _status) -> None:
        self._timer.stop()
        if self._settled:
            return
        stderr = ""
        if self._proc is not None:
            try:
                stderr = bytes(self._proc.readAllStandardError()).decode("utf-8", errors="replace")
            except Exception:  # noqa: BLE001
                stderr = ""
        payload = self._done
        if payload is None:
            if self._cancel_requested:
                payload = _cancelled_payload()
            else:
                payload = {
                    "type": "done",
                    "verdict": "fail",
                    "score": 0,
                    "summary": "判题进程未正常结束（可能超时被杀或崩溃）。",
                }
                if stderr.strip():
                    payload["summary"] += " " + stderr.strip().splitlines()[-1][:200]
        payload["exit_code"] = code
        self._settle(payload)

    def _on_error(self, err) -> None:
        """任何 QProcess 级异常都必须收尾。

        旧实现只处理 ``FailedToStart``；一旦子进程 ``Crashed`` 且 ``finished``
        因故未送达，前端就会永久停在「正在编译并运行……」。
        """
        if err == QProcess.FailedToStart:
            self.failed.emit("无法启动判题进程（FailedToStart）。")
            self._fail_finish("无法启动判题进程。")
            return
        if self._settled:
            return
        names = {
            QProcess.Crashed: "判题进程崩溃（Crashed）",
            QProcess.Timedout: "判题进程等待超时（Timedout）",
            QProcess.WriteError: "向判题进程写入失败（WriteError）",
            QProcess.ReadError: "读取判题进程输出失败（ReadError）",
            QProcess.UnknownError: "判题进程发生未知错误（UnknownError）",
        }
        self._fail_finish(names.get(err, "判题进程异常结束。"))

    def _on_stall(self) -> None:
        self._fail_finish(
            f"判题超过 {self._stall_ms / 1000:.0f} 秒没有任何输出，疑似死循环或永久等待，已强制结束。"
        )

    def _on_guard(self) -> None:
        self._fail_finish(f"判题超时（超过 {self._timeout_sec:.0f} 秒），已强制结束。")

    def _on_timeout(self) -> None:
        self._fail_finish(f"判题超时（超过 {self._timeout_sec:.0f} 秒），已强制结束。")

    def _fail_finish(self, msg: str) -> None:
        """杀掉进程树并以「未通过」载荷收尾，保证界面一定解锁。"""
        if self._settled:
            return
        self._timer.stop()
        self._stall.stop()
        self._guard.stop()
        self._kill()
        self._settle({"type": "done", "verdict": "fail", "score": 0, "summary": msg})

    # -- settle ------------------------------------------------------------
    def _settle_cancelled(self) -> None:
        if self._settled:
            return
        self._settle(_cancelled_payload())

    def _settle(self, payload: dict) -> None:
        """收尾：只发一次 ``finished``，并清理临时目录。"""
        if self._settled:
            return
        self._settled = True
        self._timer.stop()
        self._stall.stop()
        self._guard.stop()
        proc, self._proc = self._proc, None
        self.finished.emit(payload)
        if proc is not None and proc.state() == QProcess.NotRunning:
            proc.deleteLater()
        self._cleanup_tmp()

    def _kill(self) -> None:
        """非阻塞地结束判题进程及其子孙树（不等待，避免卡住 UI 线程）。"""
        if self._job.available:
            self._job.terminate()  # TerminateJobObject：一次终结整棵树
        proc = self._proc
        if proc is not None and proc.state() != QProcess.NotRunning:
            proc.kill()

    def _cleanup_tmp(self) -> None:
        if self._tmp_dir:
            cleanup_temp_dir(self._tmp_dir)
            self._tmp_dir = None


def _cancelled_payload() -> dict:
    """用户主动停止判题时的收尾载荷（前端据此显示「已停止」）。"""
    return {
        "type": "done",
        "verdict": "cancelled",
        "score": 0,
        "summary": "已停止判题。",
        "cancelled": True,
    }


def _to_qenv(env: dict):
    from PySide6.QtCore import QProcessEnvironment

    qenv = QProcessEnvironment()
    for key, value in env.items():
        qenv.insert(key, str(value))
    return qenv
