"""Judge subsystem (parent side = Qt, child side = pure Python).

* :mod:`app.judge.launcher`  - QProcess launcher used by the GUI
* :mod:`app.judge.runner`    - the headless child process
* :mod:`app.judge.harness`   - instrumented concurrency primitives
* :mod:`app.judge.invariants`- invariant checkers
* :mod:`app.judge.sandbox`   - Job Object / temp dir helpers
"""

from __future__ import annotations

import os
import sys


def problems_dir(app_root: str) -> str:
    return os.path.join(app_root, "app", "judge", "problems")


def problem_spec_path(app_root: str, problem_id: str) -> str:
    """Resolve ``<problems>/<id>/spec.json`` after validating the id."""
    if not problem_id or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-" for c in problem_id):
        raise ValueError(f"非法题目 id：{problem_id!r}")
    return os.path.join(problems_dir(app_root), problem_id, "spec.json")


def build_command(app_root: str, frozen: bool, spec_path: str, solution_path: str) -> list[str]:
    """Command that re-enters this program in headless judge mode.

    Frozen builds reuse the exe itself; dev runs go through ``app/main.py`` so
    the exact same ``--judge`` branch is exercised during development.
    """
    if frozen:
        return [sys.executable, "--judge", "--problem", spec_path, "--solution", solution_path]
    entry = os.path.join(app_root, "app", "main.py")
    return [sys.executable, entry, "--judge", "--problem", spec_path, "--solution", solution_path]
