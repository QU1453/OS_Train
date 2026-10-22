# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller 打包规格：OS_Train（onedir，扁平布局）。

设计要点（详见 .trae/documents/os-review-desktop-app-plan.md 阶段 7）：
* **onedir** 而非 onefile：onefile 会在每次启动时把全部内容解压到 %TEMP%（C 盘），
  违反「零 C 盘写入」规则。
* **contents_directory="."**：恢复 PyInstaller 6 之前的扁平布局，让 `_internal` 目录
  不再出现，从而使冻结后 `app_root() == resource_root() == exe 所在目录`，
  与开发期目录结构一致——判题规格 `app/judge/problems/**`、`ui/`、`lessons/`、
  `assets/` 全部按原相对路径命中，无需改动任何 Python 路径逻辑。
* **console=False**（windowed）：GUI 启动无黑框。判题子进程复用同一个 exe，
  其 stdout 由父进程 QProcess 以管道传入；`app/judge/runner.py` 会把这根继承来的
  句柄重新绑定回 `sys.stdout`（见 `_ensure_std_streams`）。
* 保留 QtWebEngine 必需资源（`QtWebEngineProcess.exe`、`resources/`、
  `qtwebengine_locales/en-US.pak`），仅裁掉用不到的 Qt 翻译（.qm）与多余语言包。

构建命令（务必在项目根目录执行，见 build/build.ps1）：
    .venv\\Scripts\\pyinstaller.exe build/os_train.spec --noconfirm --clean
"""

import os
import sys

# SPECPATH 指向 build/ 目录；项目根目录是它的上一级。
ROOT = os.path.abspath(os.path.join(SPECPATH, os.pardir))

# --- QtWebEngine 收集修复：把 build-time DLL 预加载 shim 暴露给隔离子进程 ----------
# 背景：PyInstaller 的 Qt 钩子通过 `@isolated.decorate` 在**独立的纯 Python 子进程**
#   里执行 `import PySide6.QtCore` 来读取 Qt 版本。本机 PATH 上存在同名 Qt6 DLL
#   （STM32CubeProgrammer/Anaconda），导致子进程导入 QtCore 报 WinError 127
#   （找不到指定的程序），于是 `pyside6_library_info.version is None`，
#   收集 QtWebEngine 资源的钩子整体跳过 → 产物缺失 QtWebEngineProcess.exe /
#   resources/ / qtwebengine_locales/。
# 对策：PyInstaller 的 `isolated/_parent.py::_subprocess_env()` 会
#   `env["PYTHONPATH"] = CONF["pathex"] + [os.environ["PYTHONPATH"]]`，且子进程
#   未加 `-S`（`site` 会执行）→ 只要把含 `sitecustomize.py` 的目录放进 pathex，
#   子进程启动时就会自动导入该 shim，在其中预加载 shiboken6/pyside6/Qt6Core
#   的 DLL 链（与 app/bootstrap.py::preload_qt_dlls 同一手法），使真正的
#   `collect_qtwebengine_files()` 得以运行。
# 注意：`_shim/sitecustomize.py` 仅构建期使用，不会被收集进产物。
_SHIM = os.path.join(SPECPATH, "_shim")
_pathex = [_SHIM, ROOT]
# 双保险：_subprocess_env() 也会读取 os.environ["PYTHONPATH"]。
os.environ["PYTHONPATH"] = os.pathsep.join(
    [_SHIM] + ([os.environ["PYTHONPATH"]] if os.environ.get("PYTHONPATH") else [])
)

# 运行期需要读取的只读资源（不含 Python 模块）。
datas = [
    (os.path.join(ROOT, "ui"), "ui"),
    (os.path.join(ROOT, "lessons"), "lessons"),
    (os.path.join(ROOT, "assets"), "assets"),
    # 判题规格与参考实现由 runner 以文件路径动态加载，必须整体带上。
    (os.path.join(ROOT, "app", "judge", "problems"), os.path.join("app", "judge", "problems")),
]

# 函数体内 import 的模块，静态分析已能覆盖，这里显式声明以增强健壮性。
hiddenimports = [
    "app.bootstrap",
    "app.bridge",
    "app.content_loader",
    "app.local_server",
    "app.progress",
    "app.window",
    "app.judge.launcher",
    "app.judge.runner",
    "app.judge.harness",
    "app.judge.invariants",
    "app.judge.sandbox",
]

# 只排除确定与运行无关的第三方包；Qt 模块一律不排（QtWebEngine 依赖 QtQml/QtQuick，
# 误排会导致运行期缺 DLL 崩溃，而 PyInstaller 本身也只收集被 import 到的 Qt 模块）。
excludes = [
    "tkinter",
    "_tkinter",
    "PyQt5",
    "PyQt6",
    "PySide2",
    "matplotlib",
    "numpy",
    "pandas",
    "scipy",
    "IPython",
    "jupyter",
    "notebook",
    "pytest",
]

a = Analysis(
    [os.path.join(ROOT, "app", "main.py")],
    pathex=_pathex,
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,
)

# --- 资源裁剪：去掉用不到的 Qt 翻译与多余语言包 -------------------------------
# 应用未使用 QTranslator，PySide6/Qt 的 *.qm 全部可删；qtwebengine_locales 仅
# 保留 en-US 与 zh-CN（Chromium 自带的菜单文案，界面文案全部由我们自己的 HTML 提供）。
_KEEP_LOCALES = {"en-us.pak", "zh-cn.pak"}


def _keep_data(dest: str) -> bool:
    d = (dest or "").replace("\\", "/").lower()
    if d.endswith(".qm"):
        return False
    if "qtwebengine_locales/" in d:
        return d.rsplit("/", 1)[-1] in _KEEP_LOCALES
    return True


a.datas = [t for t in a.datas if _keep_data(t[0])]

# --- 二进制裁剪：剔除 PATH 泄漏进来的 ICU DLL（修复冻结后启动崩溃） ----------------
# 背景：本机 PATH 上存在 Anaconda（D:\\Application\\ToolsInComputer\\anaconda\\Library\\bin），
#   其中带有 icuuc.dll / icudt73.dll（ICU 73）。PyInstaller 的依赖分析在解析
#   `Qt6Core.dll` 的 `icuuc.dll` 导入时，按 PATH 命中了 Anaconda 的 ICU 73 副本，
#   于是把它收集到产物根目录。
# 问题：PySide6 6.11 的 Qt6Core 是按 **ICU 72** 构建的（ICU 的导出符号带版本后缀，
#   如 `u_strlen_72`）。开发期 venv 里并没有 ICU（PySide6 轮子不带 ICU），Qt6Core
#   由 Windows 11 System32 的 `icuuc.dll`（v72.1.0.4）满足依赖，因此可正常运行。
#   一旦产物里带上 Anaconda 的 ICU 73，加载器就会优先命中它，而它没有 `_72` 符号
#   → 报 `ImportError: DLL load failed while importing QtCore: 找不到指定的程序。`
#   （WinError 127 ERROR_PROC_NOT_FOUND）。
# 对策：把一切 `icu*.dll` 从产物二进制中剔除，让 Qt6Core 回落到与 venv 完全一致的
#   System32 ICU 72。venv 本就无 ICU，故此举不引入任何缺失依赖。
_BAD_BIN_PREFIX = "icu"
_BAD_BIN_SUFFIX = ".dll"


def _keep_binary(dest: str) -> bool:
    name = os.path.basename((dest or "").replace("\\", "/")).lower()
    if name.startswith(_BAD_BIN_PREFIX) and name.endswith(_BAD_BIN_SUFFIX):
        return False
    return True


a.binaries = [t for t in a.binaries if _keep_binary(t[0])]

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="OS_Train",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,            # windowed：GUI 无黑框；判题子进程靠继承的管道输出
    disable_windowed_traceback=False,
    contents_directory=".",   # 扁平 onedir 布局（app_root == resource_root）
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="OS_Train",
)
