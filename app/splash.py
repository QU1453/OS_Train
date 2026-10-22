"""启动等待界面（Splash）：带进度条的浅色启动画面。

在 ``MainWindow`` 构建之前显示，覆盖「启动服务 / 载入界面」这段等待时间。

用法（见 ``app/main.py``）::

    splash = Splash(version="v1.0.0")
    splash.show_centered()
    win = MainWindow(..., progress=splash.set_progress)   # 构建期汇报里程碑
    win.ready.connect(lambda: (win.show(), splash.finish()))

配色沿用 ``ui/css/theme.css`` 的浅色令牌，保证与主界面一致：
底色 ``#F2F4F7``、卡片 ``#FFFFFF``、边框 ``#E2E8EF``、主色 ``#0B7D6F``。
"""

from __future__ import annotations

from PySide6.QtCore import QEasingCurve, QPropertyAnimation, QRectF, Qt, QTimer
from PySide6.QtGui import QColor, QLinearGradient, QPainter, QPainterPath
from PySide6.QtWidgets import (
    QApplication,
    QFrame,
    QGraphicsDropShadowEffect,
    QHBoxLayout,
    QLabel,
    QVBoxLayout,
    QWidget,
)

# ---- 设计令牌（与 ui/css/theme.css 对齐） ------------------------------------
_SURFACE = "#FFFFFF"
_LINE = "#E2E8EF"
_TEXT_1 = "#16202B"
_TEXT_2 = "#47576A"
_TEXT_3 = "#6B7C8F"
_ACCENT = "#0B7D6F"
_ACCENT_2 = "#16A896"

_UI_FONT = "'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans SC', sans-serif"
_MONO_FONT = "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace"

_WIDTH = 476
_HEIGHT = 202


class _ProgressBar(QWidget):
    """细长圆角进度条：``value >= 0`` 为确定进度，``value < 0`` 为不确定动画。"""

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setFixedHeight(6)
        self._value = 0
        self._phase = 0.0
        self._spin = QTimer(self)
        self._spin.setInterval(24)
        self._spin.timeout.connect(self._tick)

    def set_value(self, value: int) -> None:
        self._value = max(-1, min(100, int(value)))
        if self._value < 0:
            if not self._spin.isActive():
                self._spin.start()
        else:
            self._spin.stop()
        self.update()

    def _tick(self) -> None:
        self._phase = (self._phase + 0.028) % 1.0
        self.update()

    def paintEvent(self, _event) -> None:  # noqa: N802 - Qt 命名
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        radius = self.height() / 2.0
        track = QRectF(0, 0, self.width(), self.height())

        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QColor(_LINE))
        painter.drawRoundedRect(track, radius, radius)

        gradient = QLinearGradient(0, 0, self.width(), 0)
        gradient.setColorAt(0.0, QColor(_ACCENT))
        gradient.setColorAt(1.0, QColor(_ACCENT_2))
        painter.setBrush(gradient)

        if self._value < 0:
            band = self.width() * 0.34
            x = -band + (self.width() + band) * self._phase
            clip = QPainterPath()
            clip.addRoundedRect(track, radius, radius)
            painter.setClipPath(clip)
            painter.drawRoundedRect(
                QRectF(x, 0, band, self.height()), radius, radius
            )
        elif self._value > 0:
            w = max(self.width() * (self._value / 100.0), self.height())
            painter.drawRoundedRect(QRectF(0, 0, w, self.height()), radius, radius)


class Splash(QWidget):
    """无边框浅色启动画面：应用标识 + 进度条 + 状态文字。"""

    def __init__(self, version: str = "", parent: QWidget | None = None) -> None:
        super().__init__(
            parent,
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.SplashScreen,
        )
        self.setWindowTitle("操作系统复习")
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedSize(_WIDTH, _HEIGHT)
        self._finished = False
        self._fade: QPropertyAnimation | None = None
        self._build(version)

    # ------------------------------------------------------------------
    def _build(self, version: str) -> None:
        outer = QVBoxLayout(self)
        outer.setContentsMargins(18, 18, 18, 18)  # 给投影留出空间

        card = QFrame(self)
        card.setObjectName("card")
        card.setStyleSheet(
            f"""
            #card {{
                background: {_SURFACE};
                border: 1px solid {_LINE};
                border-radius: 14px;
                font-family: {_UI_FONT};
            }}
            QLabel {{ background: transparent; }}
            #glyph {{
                border: 1px solid {_LINE};
                border-radius: 10px;
                background: rgba(11, 125, 111, 0.10);
                color: {_ACCENT};
                font-family: {_MONO_FONT};
                font-size: 15px;
                font-weight: 700;
            }}
            #title {{ color: {_TEXT_1}; font-size: 16px; font-weight: 700; }}
            #sub {{
                color: {_TEXT_3}; font-size: 11px;
                font-family: {_MONO_FONT}; letter-spacing: 1px;
            }}
            #ver, #pct {{
                color: {_TEXT_3}; font-size: 11px; font-family: {_MONO_FONT};
            }}
            #pct {{ color: {_ACCENT}; font-weight: 600; }}
            #status {{ color: {_TEXT_2}; font-size: 12px; }}
            """
        )
        shadow = QGraphicsDropShadowEffect(card)
        shadow.setBlurRadius(30)
        shadow.setOffset(0, 6)
        shadow.setColor(QColor(15, 25, 40, 62))
        card.setGraphicsEffect(shadow)
        outer.addWidget(card)

        body = QVBoxLayout(card)
        body.setContentsMargins(22, 20, 22, 18)
        body.setSpacing(0)

        head = QHBoxLayout()
        head.setSpacing(12)
        glyph = QLabel("OS", card)
        glyph.setObjectName("glyph")
        glyph.setFixedSize(40, 40)
        glyph.setAlignment(Qt.AlignmentFlag.AlignCenter)
        head.addWidget(glyph)

        titles = QVBoxLayout()
        titles.setSpacing(1)
        title = QLabel("操作系统复习", card)
        title.setObjectName("title")
        subtitle = QLabel("进程与调度 · 内存管理之前", card)
        subtitle.setObjectName("sub")
        titles.addWidget(title)
        titles.addWidget(subtitle)
        head.addLayout(titles)
        head.addStretch(1)

        ver = QLabel(version or "", card)
        ver.setObjectName("ver")
        ver.setAlignment(
            Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignTop
        )
        head.addWidget(ver)
        body.addLayout(head)
        body.addStretch(1)

        self._bar = _ProgressBar(card)
        body.addWidget(self._bar)
        body.addSpacing(10)

        foot = QHBoxLayout()
        foot.setSpacing(10)
        self._status = QLabel("正在启动…", card)
        self._status.setObjectName("status")
        self._pct = QLabel("0%", card)
        self._pct.setObjectName("pct")
        self._pct.setAlignment(
            Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
        )
        foot.addWidget(self._status, 1)
        foot.addWidget(self._pct)
        body.addLayout(foot)

    # ------------------------------------------------------------------
    def show_centered(self) -> None:
        """居中（略高于正中）显示，并立刻处理一次事件以便绘制出来。"""
        screen = QApplication.primaryScreen()
        if screen is not None:
            g = screen.availableGeometry()
            self.move(
                g.center().x() - self.width() // 2,
                int(g.center().y() - self.height() / 2 - g.height() * 0.06),
            )
        self.show()
        QApplication.processEvents()

    def set_progress(self, value: int, text: str | None = None) -> None:
        """汇报进度。``value`` 取 0-100（负数表示不确定进度）。"""
        if self._finished:
            return
        self._bar.set_value(value)
        if value < 0:
            self._pct.setText("· · ·")
        else:
            self._pct.setText(f"{max(0, min(100, int(value)))}%")
        if text:
            self._status.setText(text)
        # 构建/导入都是同步长任务，这里必须主动刷新，否则启动画面会僵住。
        QApplication.processEvents()

    def finish(self) -> None:
        """收尾：进度补满、淡出并关闭。重复调用是安全的。"""
        if self._finished:
            return
        self._finished = True
        self._bar.set_value(100)
        self._pct.setText("100%")
        self._status.setText("准备就绪")
        QApplication.processEvents()
        self._fade = QPropertyAnimation(self, b"windowOpacity", self)
        self._fade.setDuration(150)
        self._fade.setStartValue(1.0)
        self._fade.setEndValue(0.0)
        self._fade.setEasingCurve(QEasingCurve.Type.InQuad)
        self._fade.finished.connect(self.close)
        self._fade.start()
