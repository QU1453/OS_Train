"""Instrumented primitives for concurrency problems.

Students write ``def run(S):`` and use:

* ``S.sem(initial)``        -> a counting semaphore
* ``S.P(s)`` / ``S.V(s)``   -> down / up
* ``S.buffer(capacity)``    -> a bounded buffer (``.put(item)`` / ``.get()``)
* ``S.counter(initial)``    -> a shared integer (``.inc()`` / ``.dec()`` / ``.read()``)
  whose ``inc``/``dec`` are intentionally non-atomic, so a missing mutex around
  ``readcount`` shows up as a lost update
* ``S.enter(label)`` / ``S.exit(label)`` -> mark entry to / exit from a labelled
  region (used by the ``no_concurrent`` invariant for reader/writer style
  problems, where a ``cfg.exclusive_labels`` region must never host two
  processes at once)
* ``S.spawn(fn, *args)``    -> start a thread (joined automatically afterwards)
* ``S.sleep(ms)`` / ``S.log(*a)``

Why instrumentation: CPython's GIL hides many races, and a student's
``P``/``V`` sequence is atomic anyway. By stretching the *shared* buffer
operations (read count -> jitter -> write count) we widen the race window so
that a missing mutex reliably corrupts the buffer counter across a handful of
runs. Invariants that leak (overflow, underflow, lost updates, deadlock) are
reported as concrete evidence.
"""

from __future__ import annotations

import os
import random
import threading
import time


class Violation(Exception):
    """Raised when an invariant is broken."""


class Semaphore:
    def __init__(self, initial: int, name: str = "s"):
        self.name = name
        self.value = int(initial)
        self._initial = int(initial)
        self._cond = threading.Condition(threading.Lock())

    def P(self) -> None:
        with self._cond:
            while self.value <= 0:
                self._cond.wait()
            self.value -= 1

    def V(self) -> None:
        with self._cond:
            self.value += 1
            self._cond.notify()


class Buffer:
    """Bounded buffer whose internal counter is intentionally non-atomic.

    Two defences catch a missing mutex:

    * ``_enter`` detects two threads being *inside* ``put``/``get`` at the same
      time - in a textbook producer/consumer the whole buffer operation is one
      critical section, so concurrency here is always a bug.
    * the counter is read, jittered, then written back, so a missing mutex also
      desynchronises ``count`` from the real item list (lost update).
    """

    def __init__(self, capacity: int, harness: "Harness"):
        self.capacity = int(capacity)
        self._h = harness
        self._items: list = []
        self.count = 0
        self._busy = 0

    def size(self) -> int:
        return self.count

    @property
    def items_len(self) -> int:
        return len(self._items)

    def _enter(self, op: str) -> None:
        with self._h._lock:
            self._busy += 1
            over = self._busy > 1
        if over:
            self._h.violation(
                f"并发进入临界区：{op}() 正与另一个线程同时操作缓冲区"
                "（缺少 mutex 互斥信号量）"
            )

    def _leave(self) -> None:
        with self._h._lock:
            self._busy -= 1

    def put(self, item) -> None:
        self._enter("put")
        try:
            if len(self._items) >= self.capacity:
                self._h.violation("缓冲区溢出：缓冲区已满仍然执行 put()（PV 顺序错误）")
            _jitter()
            c = self.count
            _jitter()
            self._items.append(item)
            self.count = c + 1
            if self.count > self._h.max_in_flight:
                self._h.max_in_flight = self.count
            self._h._produced.append(item)
        finally:
            self._leave()

    def get(self):
        self._enter("get")
        try:
            if not self._items:
                self._h.violation("缓冲区下溢：缓冲区为空仍然执行 get()（PV 顺序错误）")
            _jitter()
            c = self.count
            _jitter()
            try:
                item = self._items.pop()
            except IndexError:
                self._h.violation("并发读取破坏了缓冲区（缺少互斥）")
                raise
            self.count = c - 1
            self._h._consumed.append(item)
            return item
        finally:
            self._leave()


def _jitter(lo: float = 0.0, hi: float = 0.0006) -> None:
    """Yield the CPU to widen race windows between read-modify-write steps.

    Windows' default timer granularity is ~15.6 ms, so even
    ``time.sleep(0.0006)`` blocks a thread for a whole tick.  A sub-millisecond
    sleep therefore made *correct* solutions run tens of times slower than
    intended and trip the judge's ``run_timeout_sec`` (reported as a false
    "deadlock or timeout").  ``time.sleep(0)`` still forces a genuine scheduler yield
    there and keeps buggy solutions detectable, so use it on Windows and keep
    the fine-grained randomized sleep on platforms where sub-ms sleeps are real.
    """
    if os.name == "nt":
        time.sleep(0)
    else:
        time.sleep(random.uniform(lo, hi))


class Counter:
    """A shared integer whose read-modify-write is intentionally non-atomic.

    Used by reader/writer-style problems: ``readcount`` must be protected by a
    small mutex, otherwise two readers lose an update.  Reads are harmless and
    never checked, so ``S.read()`` is always safe to call concurrently.
    """

    def __init__(self, initial: int = 0, name: str = "count", harness: "Harness | None" = None):
        self.name = str(name)
        self._h = harness
        self._base = int(initial)
        self.value = int(initial)
        self.ops = 0      # net delta of all inc/dec recorded by the harness
        self.reads = 0

    def inc(self) -> None:
        _jitter()
        v = self.value
        _jitter()
        self.value = v + 1
        if self._h is not None:
            with self._h._lock:
                self.ops += 1

    def dec(self) -> None:
        _jitter()
        v = self.value
        _jitter()
        self.value = v - 1
        if self._h is not None:
            with self._h._lock:
                self.ops -= 1

    def read(self) -> int:
        if self._h is not None:
            with self._h._lock:
                self.reads += 1
        return self.value

    @property
    def expected(self) -> int:
        """Value the counter *would* have if no update was lost."""
        return self._base + self.ops


class Harness:
    def __init__(self, cfg: dict | None = None):
        self.cfg = dict(cfg or {})
        self._sems: dict[str, Semaphore] = {}
        self._buffers: list[Buffer] = []
        self._threads: list[threading.Thread] = []
        self._counter = 0
        self._lock = threading.Lock()
        self._produced: list = []
        self._consumed: list = []
        self._violations: list[str] = []
        self._errors: list[str] = []
        self.log_lines: list[str] = []
        self.max_in_flight = 0
        # labelled exclusive regions (reader/writer, philosophers, ...)
        self._regions: dict[str, int] = {}
        self._region_peak: dict[str, int] = {}
        self._overlaps: list[str] = []
        self._exclusive = {str(x) for x in (self.cfg.get("exclusive_labels") or [])}
        # cross-label mutual exclusion, e.g. [["read", "write"]]
        self._conflicts: dict[str, set[str]] = {}
        for pair in self.cfg.get("conflict_labels") or []:
            try:
                a, b = str(pair[0]), str(pair[1])
            except (TypeError, IndexError, KeyError):
                continue
            self._conflicts.setdefault(a, set()).add(b)
            self._conflicts.setdefault(b, set()).add(a)
        self._counters: list[Counter] = []

    # -- primitives --------------------------------------------------------
    def sem(self, initial: int, name: str | None = None) -> Semaphore:
        self._counter += 1
        s = Semaphore(initial, name or f"sem{self._counter}")
        self._sems[s.name] = s
        return s

    def P(self, s: Semaphore) -> None:
        s.P()

    def V(self, s: Semaphore) -> None:
        s.V()

    def buffer(self, capacity: int) -> Buffer:
        b = Buffer(capacity, self)
        self._buffers.append(b)
        return b

    def counter(self, initial: int = 0, name: str = "count") -> Counter:
        c = Counter(initial, name, self)
        self._counters.append(c)
        return c

    def enter(self, label: str) -> None:
        """Mark entry to a labelled region (e.g. "读"/"写").

        Records the peak concurrent occupancy of the region.  If the region is
        declared exclusive in ``cfg["exclusive_labels"]`` and two processes
        overlap inside it, an overlap report is stored for the ``no_concurrent``
        invariant.  Unlike :meth:`Buffer._enter` this does **not** raise, so the
        run still finishes and the judge can print a full diagnostic instead of
        a cascade of deadlock noise.
        """
        label = str(label)
        with self._lock:
            cur = self._regions.get(label, 0) + 1
            self._regions[label] = cur
            if cur > self._region_peak.get(label, 0):
                self._region_peak[label] = cur
            exclusive = label in self._exclusive
            partners = {p: self._regions.get(p, 0) for p in self._conflicts.get(label, ())}
        if exclusive and cur > 1:
            msg = (
                f"互斥被破坏：{label} 区内同时有 {cur} 个进程在执行"
                "（该区要求互斥/独占访问，缺少 P/V 保护）"
            )
            with self._lock:
                if msg not in self._overlaps:
                    self._overlaps.append(msg)
        for partner, cnt in partners.items():
            if cnt <= 0:
                continue
            msg = (
                f"访问冲突：{label} 区与 {partner} 区同时有进程在执行"
                "（读者-写者要求读操作与写操作互斥）"
            )
            with self._lock:
                if msg not in self._overlaps:
                    self._overlaps.append(msg)

    def exit(self, label: str) -> None:
        """Mark exit from a labelled region (paired with :meth:`enter`)."""
        label = str(label)
        with self._lock:
            cur = self._regions.get(label, 0) - 1
            self._regions[label] = cur if cur > 0 else 0

    def sleep(self, ms: float) -> None:
        time.sleep(float(ms) / 1000.0)

    def log(self, *args) -> None:
        line = " ".join(str(a) for a in args)
        with self._lock:
            self.log_lines.append(line)
            if len(self.log_lines) > 2000:
                del self.log_lines[:1000]

    def violation(self, msg: str) -> None:
        """Record an invariant violation and stop the offending thread."""
        with self._lock:
            if msg not in self._violations:
                self._violations.append(msg)
        raise Violation(msg)

    # -- thread management -------------------------------------------------
    def spawn(self, fn, *args) -> threading.Thread:
        def _runner():
            _jitter(0.0, 0.002)  # vary interleaving
            try:
                fn(*args)
            except Violation:
                pass  # already recorded as a violation
            except BaseException as exc:  # noqa: BLE001 - report to judge
                with self._lock:
                    self._errors.append(f"{type(exc).__name__}: {exc}")

        t = threading.Thread(target=_runner, daemon=True)
        self._threads.append(t)
        t.start()
        return t

    def join_all(self, timeout: float) -> bool:
        """Join every spawned thread; return False if any is still alive."""
        deadline = time.time() + timeout
        alive = False
        for t in self._threads:
            remaining = max(0.0, deadline - time.time())
            t.join(remaining)
            if t.is_alive():
                alive = True
        return not alive

    # -- results -----------------------------------------------------------
    @property
    def produced(self) -> list:
        return list(self._produced)

    @property
    def consumed(self) -> list:
        return list(self._consumed)

    @property
    def violations(self) -> list[str]:
        with self._lock:
            return list(self._violations)

    @property
    def errors(self) -> list[str]:
        with self._lock:
            return list(self._errors)

    @property
    def buffers(self) -> list["Buffer"]:
        return list(self._buffers)

    @property
    def counters(self) -> list["Counter"]:
        return list(self._counters)

    @property
    def region_overlaps(self) -> list[str]:
        with self._lock:
            return list(self._overlaps)

    def region_peak(self, label: str) -> int:
        with self._lock:
            return self._region_peak.get(str(label), 0)
