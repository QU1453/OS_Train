"""参考答案（仅存档，判题不读取本文件）：读者—写者问题（读者优先）。

判题口径：不比对输出，而是连续多轮运行并校验不变式——
无异常、readcount 无丢失更新、写者之间互斥、读与写互斥、无死锁。
"""


def run(S):
    nr = int(S.cfg["n_readers"])
    nw = int(S.cfg["n_writers"])
    rp = int(S.cfg["rounds_per_reader"])
    wp = int(S.cfg["rounds_per_writer"])

    rmutex = S.sem(1, "rmutex")   # 保护 readcount 的小互斥信号量
    wmutex = S.sem(1, "wmutex")   # 写者互斥，同时也是读/写互斥
    readcount = S.counter(0, "readcount")

    def reader(rid):
        for _ in range(rp):
            S.P(rmutex)
            readcount.inc()
            if readcount.read() == 1:
                S.P(wmutex)       # 第一个读者：锁住写者
            S.V(rmutex)

            S.enter("read")
            S.sleep(2)            # 读数据
            S.exit("read")

            S.P(rmutex)
            readcount.dec()
            if readcount.read() == 0:
                S.V(wmutex)       # 最后一个读者：放行写者
            S.V(rmutex)

    def writer(wid):
        for _ in range(wp):
            S.P(wmutex)
            S.enter("write")
            S.sleep(2)            # 写数据
            S.exit("write")
            S.V(wmutex)

    for r in range(nr):
        S.spawn(reader, r)
    for w in range(nw):
        S.spawn(writer, w)
