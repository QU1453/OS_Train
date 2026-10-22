"""Main window: loopback HTTP + QWebEngineView + QWebChannel wiring.

The window owns the three long-lived services (HTTP server, progress store,
judge launcher) and tears them down in ``closeEvent`` so no child process or
``QtWebEngineProcess.exe`` is left behind.
"""

from __future__ import annotations

import os
from collections.abc import Callable
from pathlib import Path

from PySide6.QtCore import Qt, QUrl, Signal
from PySide6.QtGui import QCloseEvent
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineCore import QWebEngineProfile, QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import QMainWindow, QMessageBox

from . import bootstrap
from .bridge import AppBridge
from .content_loader import ContentLoader
from .judge.launcher import JudgeLauncher
from .local_server import LocalServer
from .progress import ProgressStore


class MainWindow(QMainWindow):
    #: 界面是否可以显示了（页面加载结束，无论成败）
    ready = Signal()

    def __init__(
        self,
        app_root: Path,
        resource_root: Path,
        var_dir: Path,
        version: str,
        progress: Callable[[int, str], None] | None = None,
    ):
        super().__init__()
        self.setWindowTitle("操作系统复习 · 进程与调度（内存管理之前）")
        self.resize(1440, 920)
        self.setMinimumSize(1080, 680)

        self._app_root = app_root
        self._resource_root = resource_root
        self._var_dir = var_dir
        # 构建期的耗时步骤逐条汇报给启动画面（构造时还没有信号可连）。
        self._progress = progress

        # --- services -----------------------------------------------------
        self._report(38, "正在启动本地服务…")
        self.server = LocalServer(resource_root)
        self.server.start()

        self._report(50, "正在准备进度数据库…")
        self.store = ProgressStore(var_dir / "progress.db")
        self.loader = ContentLoader(resource_root)

        self._report(60, "正在初始化判题引擎…")
        self.launcher = JudgeLauncher(
            str(app_root), str(var_dir), frozen=bootstrap.is_frozen(), parent=self
        )

        # --- web view -----------------------------------------------------
        self._report(72, "正在构建界面…")
        self._configure_profile()
        self.view = QWebEngineView(self)
        page = self.view.page()
        settings = page.settings()
        for attr in (
            QWebEngineSettings.WebAttribute.JavascriptEnabled,
            QWebEngineSettings.WebAttribute.LocalStorageEnabled,
            QWebEngineSettings.WebAttribute.WebGLEnabled,
            QWebEngineSettings.WebAttribute.Accelerated2dCanvasEnabled,
            QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled,
        ):
            settings.setAttribute(attr, True)
        settings.setAttribute(
            QWebEngineSettings.WebAttribute.ShowScrollBars, True
        )

        self.channel = QWebChannel(self.view.page())
        self.bridge = AppBridge(
            self.loader,
            self.store,
            self.launcher,
            str(app_root),
            str(var_dir),
            version,
            parent=self,
        )
        self.channel.registerObject("bridge", self.bridge)
        self.view.page().setWebChannel(self.channel)
        self.setCentralWidget(self.view)

        # 页面渲染耗时最长且不可细分，用不确定进度条（-1）避免看起来卡死。
        self._report(-1, "正在渲染课程界面…")
        self.view.load(QUrl(self.server.index_url))
        self.view.loadFinished.connect(self._on_load_finished)

    # ------------------------------------------------------------------
    def _report(self, percent: int, text: str) -> None:
        """把构建进度转交给调用方（启动画面）；失败不影响主流程。"""
        cb = self._progress
        if cb is None:
            return
        try:
            cb(percent, text)
        except Exception:  # noqa: BLE001 - 进度仅用于展示
            pass

    def _configure_profile(self) -> None:
        profile = QWebEngineProfile.defaultProfile()
        cache, storage = bootstrap.webengine_data_dir()
        try:
            profile.setCachePath(str(cache))
            profile.setPersistentStoragePath(str(storage))
            profile.setHttpCacheType(QWebEngineProfile.HttpCacheType.DiskHttpCache)
            profile.setPersistentCookiesPolicy(
                QWebEngineProfile.PersistentCookiesPolicy.NoPersistentCookies
            )
        except Exception:  # noqa: BLE001 - profile tweaks are best effort
            pass

    def _on_load_finished(self, ok: bool) -> None:
        # 先放行启动画面：失败时也要先关掉等待界面，再弹错误框。
        self._report(100, "准备就绪")
        self.ready.emit()
        if not ok:
            QMessageBox.critical(
                self,
                "加载失败",
                f"无法加载界面：{self.server.index_url}",
            )

    # ------------------------------------------------------------------
    def closeEvent(self, event: QCloseEvent) -> None:  # noqa: N802
        try:
            self.launcher.cancel()
            self.server.stop()
            self.store.close()
        finally:
            super().closeEvent(event)
