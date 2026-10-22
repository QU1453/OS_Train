"""Application entry point.

Two modes:

* ``--judge`` - headless. Runs one judging job and exits. Handled *before any
  Qt import* so the child process stays tiny and cannot pop a window.
* default   - the GUI shell (PySide6 + QtWebEngine).
"""

from __future__ import annotations

import os
import sys
import traceback

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)


def _run_judge(argv: list[str]) -> int:
    from app.judge.runner import main as judge_main

    return judge_main(argv)


def _log_startup_error(text: str) -> None:
    try:
        from app import bootstrap

        log_dir = bootstrap.var_dir() / "log"
        log_dir.mkdir(parents=True, exist_ok=True)
        with open(log_dir / "startup.log", "a", encoding="utf-8") as fh:
            fh.write(text + "\n" + "-" * 60 + "\n")
    except Exception:  # noqa: BLE001
        pass


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv if argv is None else argv)

    if "--judge" in argv:
        return _run_judge(argv)

    from app import bootstrap

    bootstrap.configure()

    from PySide6.QtCore import QTimer, Qt
    from PySide6.QtWidgets import QApplication

    QApplication.setAttribute(Qt.ApplicationAttribute.AA_ShareOpenGLContexts, True)

    app = QApplication(argv)
    app.setApplicationName("OS_Train")
    app.setApplicationDisplayName("操作系统复习")

    from app import __version__
    from app.splash import Splash

    # 先把等待界面立起来，再去做耗时的事（导入 QtWebEngine、起服务、载页面）。
    splash = Splash(version=f"v{__version__}")
    splash.show_centered()
    splash.set_progress(10, "正在准备运行环境…")

    from app.window import MainWindow

    splash.set_progress(24, "正在加载图形组件…")

    win = MainWindow(
        app_root=bootstrap.app_root(),
        resource_root=bootstrap.resource_root(),
        var_dir=bootstrap.var_dir(),
        version=__version__,
        progress=splash.set_progress,
    )

    def _on_ready() -> None:
        guard.stop()
        win.show()
        splash.finish()

    win.ready.connect(_on_ready)

    # 兜底：万一页面加载信号不到，也不能永远停在启动画面上。
    guard = QTimer()
    guard.setSingleShot(True)
    guard.setInterval(25000)
    guard.timeout.connect(_on_ready)
    guard.start()

    return app.exec()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except BaseException:  # noqa: BLE001
        tb = traceback.format_exc()
        _log_startup_error(tb)
        try:
            from PySide6.QtWidgets import QApplication, QMessageBox

            _app = QApplication.instance() or QApplication(sys.argv)
            QMessageBox.critical(None, "启动失败", tb[-1500:])
        except Exception:  # noqa: BLE001
            sys.stderr.write(tb)
        sys.exit(1)
