"""参考答案（仅存档，判题不读取本文件）：用信号量实现同步与互斥（单缓冲生产者—消费者）。

容量为 1（单缓冲）：empty 与 full 两个同步信号量负责「生产者必须等空槽、
消费者必须等产品」，mutex 负责对缓冲区本身的互斥访问。

判题口径：不比对输出，而是连续多轮运行并校验不变式——
无异常、缓冲不溢出/不下溢、计数无丢失更新、全部产出都被消费、无死锁。
"""


def run(S):
    cap = int(S.cfg["capacity"])          # 缓冲区容量（本题为 1）
    np = int(S.cfg["n_producers"])
    nc = int(S.cfg["n_consumers"])
    per = int(S.cfg["items_per_producer"])
    total = np * per

    empty = S.sem(cap, "empty")   # 同步信号量：空槽数
    full = S.sem(0, "full")       # 同步信号量：已有产品数
    mutex = S.sem(1, "mutex")     # 互斥信号量：保护缓冲区
    buf = S.buffer(cap)

    def producer(pid):
        for i in range(per):
            S.P(empty)            # 申请空槽（同步：缓冲满则等待）
            S.P(mutex)            # 互斥访问缓冲区
            buf.put((pid, i))
            S.V(mutex)
            S.V(full)             # 通知消费者：产品数 +1
            S.sleep(1)

    def consumer(cid):
        for _ in range(total // nc):
            S.P(full)             # 申请产品（同步：缓冲空则等待）
            S.P(mutex)
            item = buf.get()
            S.V(mutex)
            S.V(empty)            # 通知生产者：空槽 +1
            S.sleep(1)
            S.log("consumer", cid, "got", item)

    for p in range(np):
        S.spawn(producer, p)
    for c in range(nc):
        S.spawn(consumer, c)
