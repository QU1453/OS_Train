"""Build-time DLL preload shim for PyInstaller (Windows only).

Why this exists
---------------
PyInstaller reads Qt library information (``QLibraryInfo``) inside an *isolated*
Python subprocess (see ``PyInstaller.isolated``). On this machine that child
process cannot ``import PySide6.QtCore``: the extension module binds a
same-named ``Qt6Core.dll`` coming from another install on ``PATH``
(STM32CubeProgrammer / Anaconda) and fails with::

    ImportError: DLL load failed while importing QtCore: 找不到指定的程序
    (WinError 127 == ERROR_PROC_NOT_FOUND)

When that import fails, ``pyside6_library_info.version`` stays ``None`` and
``hook-PySide6.QtWebEngineCore.py`` silently skips its whole body -- including
``collect_qtwebengine_files()``. The frozen app then lacks
``QtWebEngineProcess.exe``, ``PySide6/resources/`` and
``PySide6/translations/qtwebengine_locales/``, so ``QWebEngineView`` cannot
start a web engine.

The fix
-------
PyInstaller spawns its isolated subprocesses as plain ``python <_child.py>``
(no ``-S`` flag), so the standard ``site`` module imports ``sitecustomize`` at
interpreter start-up. ``build/os_train.spec`` prepends this directory to
``PYTHONPATH`` before ``Analysis()`` runs, and ``PyInstaller.isolated`` copies
``os.environ`` into the child -- so this module is imported inside the child.
Loading the PySide6 abi/Qt6Core DLL chain here (the exact remedy used at
runtime by ``app/bootstrap.py::preload_qt_dlls``) repairs the child's QtCore
import, which lets the real PyInstaller hooks run and collect the QtWebEngine
assets correctly.

Scope
-----
Build-time helper only. It is never imported by the application and is not
bundled into the frozen output.
"""

import os
import sys
from pathlib import Path


def _site_candidates() -> list[Path]:
    """Directories that may hold PySide6's own Qt6 / abi DLLs."""
    cands: list[Path] = []
    prefixes = [sys.prefix]
    base = getattr(sys, "base_prefix", None)
    if base and base != sys.prefix:
        prefixes.append(base)
    for prefix in prefixes:
        site = Path(prefix) / "Lib" / "site-packages"
        cands += [site / "PySide6", site / "shiboken6"]
    # A python installed "in-tree" keeps site-packages one level up.
    for prefix in prefixes:
        site = Path(prefix) / "lib" / "site-packages"
        cands += [site / "PySide6", site / "shiboken6"]
    return cands


def _preload() -> None:
    if os.name != "nt":
        return

    cands = _site_candidates()
    pyside_dir = next((d for d in cands if d.name == "PySide6" and d.is_dir()), None)
    shiboken_dir = next((d for d in cands if d.name == "shiboken6" and d.is_dir()), None)
    if pyside_dir is None and shiboken_dir is None:
        return

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

    if not chain:
        return

    import ctypes

    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    load = k32.LoadLibraryExW
    load.restype = ctypes.c_void_p
    load.argtypes = [ctypes.c_wchar_p, ctypes.c_void_p, ctypes.c_uint32]
    for p in chain:
        if p.exists():
            load(str(p), None, 0x8)  # LOAD_WITH_ALTERED_SEARCH_PATH


# Never break interpreter start-up: on an unexpected layout we simply degrade to
# the plain (unfixed) import path, exactly as if this shim did not exist.
try:
    _preload()
except Exception:  # noqa: BLE001 - boot shim must never raise
    pass
