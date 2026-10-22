"""Early environment setup.

``configure()`` MUST be called before any Qt module is imported, because the
environment variables it sets are read by the Qt/Chromium layer at import time.

Goal: every writable byte (temp files, Chromium caches, profiles) lands on a
drive other than C. In this project the writable root is either the project
directory (development) or the executable directory (frozen).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def is_frozen() -> bool:
    """True when running from a PyInstaller bundle."""
    return bool(getattr(sys, "frozen", False))


def app_root() -> Path:
    """Writable root: project directory in dev, exe directory when frozen."""
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def resource_root() -> Path:
    """Read-only bundled resources (``ui/``, ``lessons/``, ``assets/``)."""
    if is_frozen():
        return Path(getattr(sys, "_MEIPASS", app_root()))
    return app_root()


def var_dir() -> Path:
    """Writable runtime data directory (SQLite db, judge temp, web engine)."""
    d = app_root() / "var"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _has_space(p: Path) -> bool:
    return " " in str(p)


def configure() -> None:
    """Redirect temp/profile/cache locations away from the C drive."""
    var = var_dir()

    # 1) Process temp directory.
    tmp = var / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    for key in ("TMP", "TEMP", "TMPDIR"):
        os.environ[key] = str(tmp)

    # 2) QtWebEngine disk cache / profile.
    web = var / "webengine"
    disk_cache = web / "disk_cache"
    user_data = web / "user_data"
    disk_cache.mkdir(parents=True, exist_ok=True)
    user_data.mkdir(parents=True, exist_ok=True)

    # Chromium flags cannot express quoted paths reliably, so only add them
    # when the path is space-free (the profile setters in window.py cover the
    # rest).
    if not _has_space(var):
        flags = os.environ.get("QTWEBENGINE_CHROMIUM_FLAGS", "")
        if "--disk-cache-dir" not in flags:
            extra = (
                f" --disk-cache-dir={disk_cache}"
                f" --user-data-dir={user_data}"
            )
            os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = (flags + extra).strip()

    # 3) Qt Quick / RHI 着色器管线缓存默认写到 QStandardPaths::CacheLocation，
    #    在 Windows 上即 %LOCALAPPDATA%\<应用名>（C 盘）。整个禁掉，一个字节也不落 C 盘。
    #    必须在 Qt 初始化前设置。
    os.environ.setdefault("QT_DISABLE_SHADER_DISK_CACHE", "1")
    os.environ.setdefault("QSG_RHI_DISABLE_SHADER_DISK_CACHE", "1")

    # 4) Windows: make sure PySide6 loads its own Qt6 DLLs.
    preload_qt_dlls()


def _qt_dll_dirs() -> list[Path]:
    """Candidate directories that hold PySide6's own Qt6 / abi DLLs."""
    cands: list[Path] = []
    for base in (resource_root(), app_root()):
        cands += [base / "PySide6", base / "_internal" / "PySide6"]
        cands += [base / "shiboken6", base / "_internal" / "shiboken6"]
    site = Path(sys.prefix) / "Lib" / "site-packages"
    cands += [site / "PySide6", site / "shiboken6"]
    return cands


def preload_qt_dlls() -> None:
    """Load PySide6's core DLLs with ``LOAD_WITH_ALTERED_SEARCH_PATH``.

    Why this is needed (Windows only)
    ---------------------------------
    ``import PySide6.QtCore`` can fail with::

        ImportError: DLL load failed while importing QtCore: 找不到指定的程序
        (WinError 127 == ERROR_PROC_NOT_FOUND)

    The extension module ``QtCore.pyd`` depends on ``pyside6.abi3.dll`` and
    ``Qt6Core.dll``. A plain load resolves those dependencies with the default
    search order, where PySide6's own directory is not guaranteed to come
    first; the loader can then bind a same-named DLL from elsewhere (this
    machine has bundled Qt6 copies in STM32CubeProgrammer and Anaconda on
    ``PATH``) and report a missing exported procedure.

    Pre-loading the abi/Qt6Core chain from PySide6's own directory with
    ``LOAD_WITH_ALTERED_SEARCH_PATH`` puts the correct modules into the process
    first, so the later import binds to them by base name.

    Verified on this machine: after the preload, ``QtCore``, ``QtGui``,
    ``QtWidgets``, ``QtNetwork``, ``QtWebChannel``, ``QtWebEngineCore`` and
    ``QtWebEngineWidgets`` all import successfully. Failures are swallowed on
    purpose so that a non-standard layout degrades to the plain import path.
    """
    if os.name != "nt":
        return

    dirs = [d for d in _qt_dll_dirs() if d.is_dir()]
    if not dirs:
        return

    pyside_dir = next((d for d in dirs if d.name == "PySide6"), None)
    shiboken_dir = next((d for d in dirs if d.name == "shiboken6"), None)

    for d in (pyside_dir, shiboken_dir):
        if d is not None:
            try:
                os.add_dll_directory(str(d))
            except OSError:
                pass

    chain: list[Path] = []
    if shiboken_dir is not None:
        chain.append(shiboken_dir / "shiboken6.abi3.dll")
    if pyside_dir is not None:
        chain += [pyside_dir / "pyside6.abi3.dll", pyside_dir / "Qt6Core.dll"]

    try:
        import ctypes

        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        load = k32.LoadLibraryExW
        load.restype = ctypes.c_void_p
        load.argtypes = [ctypes.c_wchar_p, ctypes.c_void_p, ctypes.c_uint32]
        for p in chain:
            if p.exists():
                load(str(p), None, 0x8)  # LOAD_WITH_ALTERED_SEARCH_PATH
    except OSError:
        pass


def webengine_data_dir() -> tuple[Path, Path]:
    """Return (disk_cache, persistent_storage) paths for the web profile."""
    web = var_dir() / "webengine"
    return web / "disk_cache", web / "user_data"
