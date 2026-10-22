"""参考答案（仅存档，判题不读取本文件）：哲学家进餐问题（破坏循环等待，避免死锁）。

每位哲学家需要两把叉子：第 i 位用左叉 i 与右叉 (i+1)%5。若所有人都「先取左叉、
再取右叉」，5 人会各自持有一把叉子并永久等待相邻者手里的另一把，形成循环等待而死锁。

本解采用「奇数号哲学家打乱取叉顺序」破坏循环等待：
  * i 为偶数：先取左叉 i，再取右叉 (i+1)%5；
  * i 为奇数：先取右叉 (i+1)%5，再取左叉 i。
可给 5 把叉子规定一个全局取用顺序（偶数序 i→i+1、奇数序 i+1→i），二者无环，
等价于「资源有序分配法」，因而不可能死锁。

判题口径：不比对输出，而是连续多轮运行并校验不变式——
无异常、同一把叉子任一时刻仅被一位哲学家持有（互斥）、无死锁。
"""


def run(S):
    n = int(S.cfg["n_philosophers"])
    rounds = int(S.cfg["rounds"])
    forks = [S.sem(1, f"fork{i}") for i in range(n)]  # 每把叉子一个二值信号量

    def philosopher(i):
        left = i
        right = (i + 1) % n
        if i % 2 == 0:
            first, second = left, right    # 偶数：先左后右
        else:
            first, second = right, left    # 奇数：先右后左，破坏循环等待

        for _ in range(rounds):
            S.P(forks[first])              # 取第一把叉子
            S.enter(f"fork{first}")        # 标注持有该叉子（no_concurrent 校验互斥）
            S.P(forks[second])             # 取第二把叉子
            S.enter(f"fork{second}")

            S.enter("eat")                 # 两把叉子到手，进餐
            S.sleep(2)
            S.exit("eat")

            S.exit(f"fork{second}")        # 先放的叉子后取（后进先出）
            S.V(forks[second])             # 放下并唤醒等待者
            S.exit(f"fork{first}")
            S.V(forks[first])

    for i in range(n):
        S.spawn(philosopher, i)
