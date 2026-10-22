"""Best-effort sandbox helpers for the judge child process.

* :class:`WindowsJob` wraps a Win32 **Job Object** so we can (a) cap the
  runner's committed memory and (b) guarantee that no judge process outlives
  the app (``KILL_ON_JOB_CLOSE``).  The stdlib ``resource`` module is
  unavailable on Windows, hence the ``ctypes`` route.
* :func:`make_temp_dir` creates a per-run scratch directory under the app's
  own ``var/`` tree, so judging never touches the C drive.

The threat model is a self-study tool, not a hardened service: everything here
is *best effort*.  If the platform lacks the API, callers keep working.
"""

from __future__ import annotations

import ctypes
import os
import shutil
import uuid
from ctypes import wintypes

IS_WINDOWS = os.name == "nt"

# -- Win32 constants -------------------------------------------------------
_JobObjectExtendedLimitInformation = 9
_JOB_OBJECT_LIMIT_PROCESS_MEMORY = 0x00000100
_JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000
_PROCESS_SET_QUOTA = 0x0100
_PROCESS_TERMINATE = 0x0001


class _IO_COUNTERS(ctypes.Structure):
    _fields_ = [
        ("ReadOperationCount", ctypes.c_ulonglong),
        ("WriteOperationCount", ctypes.c_ulonglong),
        ("OtherOperationCount", ctypes.c_ulonglong),
        ("ReadTransferCount", ctypes.c_ulonglong),
        ("WriteTransferCount", ctypes.c_ulonglong),
        ("OtherTransferCount", ctypes.c_ulonglong),
    ]


class _JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
    _fields_ = [
        ("PerProcessUserTimeLimit", wintypes.LARGE_INTEGER),
        ("PerJobUserTimeLimit", wintypes.LARGE_INTEGER),
        ("LimitFlags", wintypes.DWORD),
        ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t),
        ("ActiveProcessLimit", wintypes.DWORD),
        ("Affinity", ctypes.POINTER(ctypes.c_ulong)),
        ("PriorityClass", wintypes.DWORD),
        ("SchedulingClass", wintypes.DWORD),
    ]


class _JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
    _fields_ = [
        ("BasicLimitInformation", _JOBOBJECT_BASIC_LIMIT_INFORMATION),
        ("IoInfo", _IO_COUNTERS),
        ("ProcessMemoryLimit", ctypes.c_size_t),
        ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryUsed", ctypes.c_size_t),
        ("PeakJobMemoryUsed", ctypes.c_size_t),
    ]


class WindowsJob:
    """A Job Object with a process-memory cap and kill-on-close semantics."""

    def __init__(self, memory_limit_mb: int = 512):
        self.available = False
        self._handle = None
        self._pids: list[int] = []
        if not IS_WINDOWS:
            return
        try:
            k32 = ctypes.WinDLL("kernel32", use_last_error=True)
            k32.CreateJobObjectW.restype = wintypes.HANDLE
            handle = k32.CreateJobObjectW(None, None)
            if not handle:
                return
            info = _JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
            info.BasicLimitInformation.LimitFlags = (
                _JOB_OBJECT_LIMIT_PROCESS_MEMORY | _JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            )
            info.ProcessMemoryLimit = max(64, int(memory_limit_mb)) * 1024 * 1024
            ok = k32.SetInformationJobObject(
                handle,
                _JobObjectExtendedLimitInformation,
                ctypes.byref(info),
                ctypes.sizeof(info),
            )
            if not ok:
                k32.CloseHandle(handle)
                return
            self._k32 = k32
            self._handle = handle
            self.available = True
        except Exception:  # noqa: BLE001 - sandbox is optional
            self.available = False

    def assign(self, pid: int) -> bool:
        """Put an already-started process into the job."""
        if not self.available or not pid:
            return False
        try:
            h = self._k32.OpenProcess(_PROCESS_SET_QUOTA | _PROCESS_TERMINATE, False, pid)
            if not h:
                return False
            try:
                if self._k32.AssignProcessToJobObject(self._handle, h):
                    self._pids.append(pid)
                    return True
                return False
            finally:
                self._k32.CloseHandle(h)
        except Exception:  # noqa: BLE001
            return False

    def terminate(self) -> None:
        if self.available and self._handle:
            try:
                self._k32.TerminateJobObject(self._handle, 1)
            except Exception:  # noqa: BLE001
                pass

    def close(self) -> None:
        if self.available and self._handle:
            try:
                self._k32.CloseHandle(self._handle)  # triggers KILL_ON_JOB_CLOSE
            except Exception:  # noqa: BLE001
                pass
            self._handle = None
            self.available = False


def make_temp_dir(var_dir: str) -> str:
    """Create a fresh scratch directory under ``var/judge_tmp``."""
    base = os.path.join(var_dir, "judge_tmp")
    os.makedirs(base, exist_ok=True)
    path = os.path.join(base, uuid.uuid4().hex[:12])
    os.makedirs(path, exist_ok=True)
    return path


def cleanup_temp_dir(path: str) -> None:
    shutil.rmtree(path, ignore_errors=True)
