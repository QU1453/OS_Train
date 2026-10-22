"""参考答案（仅存档，判题不读取本文件）：用信号量机制 / PV 操作实现临界区互斥。

判题口径：不比对输出，而是连续多轮运行并校验不变式——
无异常、共享计数器无丢失更新、临界区互斥（同一时刻 cs 区内只有一个进程）、无死锁。
"""


def run(S):
    np = int(S.cfg["n_procs"])
    incs = int(S.cfg["incs_per_proc"])

    mutex = S.sem(1, "mutex")      # 互斥信号量：保证临界区同一时刻仅一个进程
    count = S.counter(0, "count")  # 非原子的共享计数器，缺互斥即暴露丢失更新

    def proc(pid):
        for _ in range(incs):
            S.P(mutex)             # 进入区：申请进入临界区
            S.enter("cs")          # 标注进入临界区（供 no_concurrent 校验互斥）
            count.inc()            # 临界区：对共享变量执行 count++
            S.exit("cs")           # 标注离开临界区
            S.V(mutex)             # 退出区：释放临界区

    for i in range(np):
        S.spawn(proc, i)
