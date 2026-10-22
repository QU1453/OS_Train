"""Judge child process: run one student solution against one problem.

Invoked by :mod:`app.judge.launcher` as::

    <python|OS_Train.exe> --judge --problem <spec.json> --solution <code.py>

It never imports Qt.  Results are streamed as one JSON object per line on
stdout so the parent can render the trace live and enforce a wall-clock
timeout by killing this process.

Two judge paradigms (see plan 9.2):

* ``deterministic`` - call the student's function on each case and compare the
  normalised result with the expected value.
* ``concurrency``   - build an instrumented :class:`Harness`, run the student's
  ``run(S)`` several times and check invariants each round.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
import threading
import traceback

_HERE = os.path.dirname(os.path.abspath(__file__))
if __package__ in (None, ""):  # executed as a script by the frozen exe
    sys.path.insert(0, os.path.dirname(os.path.dirname(_HERE)))

from app.judge import invariants as _invariants  # noqa: E402
from app.judge.harness import Harness  # noqa: E402


def _emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _ensure_std_streams() -> None:
    """Guarantee ``sys.stdout`` / ``sys.stderr`` are writable text streams.

    A PyInstaller ``--windowed`` build has no console of its own, so CPython may
    leave ``sys.stdout`` as ``None``.  The judge protocol streams one JSON
    object per line on stdout, so we reattach to the OS handles inherited from
    the parent (``app.judge.launcher`` always passes pipes) and fall back to the
    null device only when there is genuinely no usable stream.
    """
    for fd, name in ((1, "stdout"), (2, "stderr")):
        if getattr(sys, name, None) is not None:
            continue
        try:
            os.fstat(fd)
        except OSError:
            stream = open(os.devnull, "w", encoding="utf-8")  # noqa: SIM115
        else:
            stream = open(fd, "w", encoding="utf-8", buffering=1, closefd=False)  # noqa: SIM115
        setattr(sys, name, stream)
    if getattr(sys, "stdin", None) is None:
        try:
            sys.stdin = open(os.devnull, "r", encoding="utf-8")  # noqa: SIM115
        except OSError:
            pass


def _load_module(path: str, name: str):
    """Import a .py file under a unique module name (fresh namespace)."""
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"无法加载文件：{path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _norm(value):
    """Make a student's return value JSON-comparable."""
    if isinstance(value, dict):
        return {str(k): _norm(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_norm(v) for v in value]
    if isinstance(value, (set, frozenset)):
        return sorted(_norm(v) for v in value)
    if isinstance(value, float):
        return round(value, 9)
    return value


def _close(a, b, tol: float) -> bool:
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(float(a) - float(b)) <= tol
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_close(x, y, tol) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(_close(a[k], b[k], tol) for k in a)
    return a == b


def _compare(got, expected, mode: str, tol: float) -> tuple[bool, str]:
    g, e = _norm(got), _norm(expected)
    if mode == "unordered":
        try:
            ok = sorted(map(repr, g)) == sorted(map(repr, e))
        except TypeError:
            ok = g == e
        return ok, "" if ok else f"期望（不计顺序）{e}，实际 {g}"
    if mode == "numeric":
        ok = _close(g, e, tol)
        return ok, "" if ok else f"期望 {e}（容差 {tol}），实际 {g}"
    ok = g == e
    return ok, "" if ok else f"期望 {e}，实际 {g}"


# ---------------------------------------------------------------------------
# deterministic
# ---------------------------------------------------------------------------
def judge_deterministic(spec: dict, module) -> dict:
    entry = spec.get("entry", "solve")
    fn = getattr(module, entry, None)
    if not callable(fn):
        return {
            "verdict": "fail",
            "score": 0,
            "summary": f"未找到入口函数 {entry}()，请按题目要求定义它。",
            "cases": [],
        }

    arg_names = spec.get("arg_names")
    default_mode = spec.get("compare", "exact")
    tol = float(spec.get("tol", 1e-6))
    cases = spec.get("cases", [])
    results = []
    passed = 0

    for i, case in enumerate(cases):
        name = case.get("name", f"用例 {i + 1}")
        data = case.get("input", {})
        expected = case.get("expected")
        mode = case.get("compare", default_mode)
        _emit({"type": "case_start", "index": i, "name": name})
        try:
            if arg_names:
                got = fn(**{k: data[k] for k in arg_names})
            else:
                got = fn(data)
            ok, msg = _compare(got, expected, mode, tol)
        except Exception as exc:  # noqa: BLE001
            ok, msg = False, f"运行时异常：{type(exc).__name__}: {exc}"
            got = None
            _emit({"type": "case_trace", "index": i, "line": traceback.format_exc(limit=3)})
        if ok:
            passed += 1
        item = {
            "index": i,
            "name": name,
            "ok": ok,
            "msg": msg,
            "expected": _norm(expected),
            "got": _norm(got),
        }
        results.append(item)
        _emit({"type": "case_result", **item})

    total = len(cases) or 1
    score = round(100.0 * passed / total)
    verdict = "pass" if cases and passed == len(cases) else "fail"
    summary = (
        f"全部 {len(cases)} 个用例通过。" if verdict == "pass" else f"通过 {passed}/{len(cases)} 个用例。"
    )
    return {"verdict": verdict, "score": score, "summary": summary, "cases": results}


# ---------------------------------------------------------------------------
# concurrency
# ---------------------------------------------------------------------------
def _run_concurrent_once(spec: dict, module, run_timeout: float) -> dict:
    cfg = dict(spec.get("config", {}))
    entry = spec.get("entry", "run")
    fn = getattr(module, entry, None)
    if not callable(fn):
        return {
            "ok": False,
            "finished": False,
            "reason": f"未找到入口函数 {entry}(S)，请按题目要求定义它。",
            "violations": [],
            "errors": [],
            "details": [],
        }

    h = Harness(cfg)
    state: dict = {"finished": False, "error": None}

    def worker() -> None:
        try:
            fn(h)
            state["finished"] = h.join_all(run_timeout)
        except Exception as exc:  # noqa: BLE001
            state["error"] = f"{type(exc).__name__}: {exc}"

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join(run_timeout + 0.6)
    if t.is_alive():
        state["finished"] = False
        state["error"] = state["error"] or "主流程阻塞（可能在某次 P 操作上永久等待）"

    if state["error"]:
        h._errors.append(state["error"])  # surface in no_error check

    names = spec.get("invariants", ["no_error", "no_deadlock"])
    ok, details = _invariants.check_all(names, h, cfg, bool(state["finished"]))
    reason = ""
    if not ok:
        reason = next((d["msg"] for d in details if not d["ok"] and d["msg"]), "不变式校验失败")
    return {
        "ok": ok,
        "finished": bool(state["finished"]),
        "reason": reason,
        "violations": h.violations,
        "errors": h.errors,
        "details": details,
        "produced": len(h.produced),
        "consumed": len(h.consumed),
        "max_in_flight": h.max_in_flight,
        "log": h.log_lines[-40:],
    }


def judge_concurrency(spec: dict, solution_path: str) -> dict:
    runs = int(spec.get("runs", 15))
    run_timeout = float(spec.get("run_timeout_sec", 2.0))
    fail_fast = bool(spec.get("fail_fast", True))
    # 失败容忍上限：即使题面要求 fail_fast=false（为了抓偶发竞态而多跑几轮），
    # 也不允许在必然失败时把 runs 轮全跑一遍——那会让界面空等 runs×run_timeout 秒。
    max_fail = max(1, int(spec.get("max_fail_repeats", 2)))
    entry = spec.get("entry", "run")
    results = []
    stopped_early = False

    for i in range(runs):
        _emit({"type": "run_start", "run": i + 1, "runs": runs})
        try:
            mod = _load_module(solution_path, f"_student_sol_{i}")
            res = _run_concurrent_once(spec, mod, run_timeout)
        except Exception as exc:  # noqa: BLE001 - syntax/import error
            res = {
                "ok": False,
                "finished": False,
                "reason": f"代码无法加载：{type(exc).__name__}: {exc}",
                "violations": [],
                "errors": [f"{type(exc).__name__}: {exc}"],
                "details": [],
                "trace": traceback.format_exc(limit=4),
            }
        res["run"] = i + 1
        results.append(res)
        _emit({"type": "run_result", **res})
        if not res["ok"]:
            failures = sum(1 for r in results if not r["ok"])
            # 硬失败（死锁/永久等待、代码无法加载）重复无意义：立即结束，省下大量等待
            if not res.get("finished") or failures >= max_fail or fail_fast:
                stopped_early = True
                break

    passed = sum(1 for r in results if r["ok"])
    verdict = "pass" if passed == runs else "fail"
    score = round(100.0 * passed / max(1, runs))
    if verdict == "pass":
        summary = f"连续 {runs} 轮全部通过，未发现竞态/死锁。"
    else:
        first_bad = next((r for r in results if not r["ok"]), results[-1])
        summary = f"第 {first_bad.get('run')} 轮失败：{first_bad.get('reason', '未通过')}"
        if stopped_early and len(results) < runs:
            summary += f"（已提前结束，未跑满 {runs} 轮）"
    return {
        "verdict": verdict,
        "score": score,
        "summary": summary,
        "runs": results,
        "ran_runs": len(results),
        "passed_runs": passed,
        "total_runs": runs,
    }


# ---------------------------------------------------------------------------
def main(argv: list[str] | None = None) -> int:
    _ensure_std_streams()
    parser = argparse.ArgumentParser(prog="OS_Train --judge")
    parser.add_argument("--judge", action="store_true")
    parser.add_argument("--problem", required=True)
    parser.add_argument("--solution", required=True)
    args = parser.parse_args(argv[1:] if argv is not None else None)

    try:
        with open(args.problem, "r", encoding="utf-8") as fh:
            spec = json.load(fh)
    except Exception as exc:  # noqa: BLE001
        _emit({"type": "done", "verdict": "error", "score": 0, "summary": f"题面读取失败：{exc}"})
        return 2

    kind = spec.get("kind", "deterministic")
    _emit({"type": "start", "problem": spec.get("id"), "kind": kind, "title": spec.get("title")})

    try:
        if kind == "concurrency":
            payload = judge_concurrency(spec, args.solution)
        else:
            module = _load_module(args.solution, "_student_sol")
            payload = judge_deterministic(spec, module)
    except Exception as exc:  # noqa: BLE001
        _emit({"type": "done", "verdict": "error", "score": 0, "summary": f"判题器内部错误：{exc}"})
        _emit({"type": "debug", "trace": traceback.format_exc()})
        return 3

    _emit({"type": "done", **payload})
    return 0


if __name__ == "__main__":
    sys.exit(main())
