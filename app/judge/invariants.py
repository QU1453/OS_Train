"""Invariant checkers for the concurrency (instrumented) judge.

Each check receives the finished :class:`~app.judge.harness.Harness`, the
problem config and a flag telling whether every worker thread ended within the
timeout.  A check returns ``(ok, message)`` where ``message`` explains a
failure in student-friendly Chinese.

A problem lists the invariants it cares about in ``spec.json``; the runner runs
all of them and the verdict is the conjunction.  Missing-mutex solutions are
caught by ``no_overflow`` / ``no_underflow`` / ``no_lost_update``; wrong PV
order or forgotten ``V`` shows up as ``no_deadlock`` / ``liveness``; broken
mutual exclusion inside a labelled region (reader/writer, philosophers) is
caught by ``no_concurrent``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:  # pragma: no cover
    from .harness import Harness

CheckFn = Callable[["Harness", dict, bool], "tuple[bool, str]"]

CHECKS: dict[str, CheckFn] = {}


def invariant(name: str) -> Callable[[CheckFn], CheckFn]:
    def deco(fn: CheckFn) -> CheckFn:
        CHECKS[name] = fn
        return fn

    return deco


@invariant("no_error")
def _no_error(h: "Harness", cfg: dict, finished: bool) -> tuple[bool, str]:
    errs = h.errors
    if errs:
        return False, "学生代码运行时抛出异常：" + errs[0]
    return True, ""


@invariant("no_overflow")
def _no_overflow(h: "Harness", cfg: dict, finished: bool) -> tuple[bool, str]:
    bad = [v for v in h.violations if "溢出" in v]
    if bad:
        return False, bad[0]
    return True, ""


@invariant("no_underflow")
def _no_underflow(h: "Harness", cfg: dict, finished: bool) -> tuple[bool, str]:
    bad = [v for v in h.violations if "下溢" in v]
    if bad:
        return False, bad[0]
    return True, ""


@invariant("no_lost_update")
def _no_lost_update(h: "Harness", cfg: dict, finished: bool) -> tuple[bool, str]:
    """A correct solution keeps counter and real item count in lock-step."""
    for i, b in enumerate(h.buffers):
        if b.count != b.items_len:
            return (
                False,
                f"缓冲区计数与实际内容不一致（count={b.count}, 实际={b.items_len}）："
                "并发修改共享变量时缺少互斥，发生了丢失更新",
            )
        if b.items_len > b.capacity:
            return False, f"缓冲区实际内容超过容量（{b.items_len} > {b.capacity}）"
    for c in h.counters:
        if c.value != c.expected:
            return (
                False,
                f"共享变量「{c.name}」发生丢失更新：应有 {c.expected}，实际 {c.value}"
                "（对共享计数变量 count++ / count-- 时缺少互斥信号量）",
            )
    return True, ""


@invariant("no_concurrent")
def _no_concurrent(h: "Harness", cfg: dict, finished: bool) -> tuple[bool, str]:
    """An exclusive region (``cfg["exclusive_labels"]``) must never host 2 procs."""
    bad = h.region_overlaps
    if bad:
        return False, bad[0]
    for label in cfg.get("require_regions") or []:
        if h.region_peak(label) < 1:
            return (
                False,
                f"未检测到进入互斥区「{label}」：请用 S.enter(\"{label}\") / "
                f"S.exit(\"{label}\") 把临界区标注出来",
            )
    return True, ""


@invariant("liveness")
def _liveness(h: "Harness", cfg: dict, finished: bool) -> tuple[bool, str]:
    produced, consumed = len(h.produced), len(h.consumed)
    if produced != consumed:
        return (
            False,
            f"存活性问题：共产出 {produced} 个数据，只消费了 {consumed} 个",
        )
    expect = cfg.get("expected_total")
    if expect is not None and produced != expect:
        return (
            False,
            f"产出数量不符：期望 {expect} 个，实际 {produced} 个"
            "（可能是线程提前退出或死锁后被中断）",
        )
    return True, ""


@invariant("no_deadlock")
def _no_deadlock(h: "Harness", cfg: dict, finished: bool) -> tuple[bool, str]:
    if not finished:
        return (
            False,
            "死锁/超时：部分线程在超时时间内没有结束"
            "（常见原因：P 与 V 不成对、PV 顺序颠倒、忘记唤醒）",
        )
    return True, ""


def check_all(
    names: list[str], h: "Harness", cfg: dict, finished: bool
) -> tuple[bool, list[dict]]:
    """Run the named invariants; return overall ok plus per-check detail."""
    details: list[dict] = []
    overall = True
    for name in names:
        fn = CHECKS.get(name)
        if fn is None:
            details.append({"name": name, "ok": True, "msg": "（未实现的检查，跳过）"})
            continue
        try:
            ok, msg = fn(h, cfg, finished)
        except Exception as exc:  # noqa: BLE001 - never let a checker crash judging
            ok, msg = False, f"不变式 {name} 自身执行异常：{type(exc).__name__}: {exc}"
        details.append({"name": name, "ok": ok, "msg": msg})
        overall = overall and ok
    return overall, details
