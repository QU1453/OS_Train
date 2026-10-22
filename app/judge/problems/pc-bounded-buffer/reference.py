"""参考答案（仅存档，判题不读取本文件）：生产者—消费者（有界缓冲区）。

判题口径：不比对输出，而是连续多轮运行并校验不变式——
无异常、缓冲不溢出/不下溢、计数无丢失更新、全部产出都被消费、无死锁。
"""


def run(S):
    cap = int(S.cfg["capacity"])
    np = int(S.cfg["n_producers"])
    nc = int(S.cfg["n_consumers"])
    per = int(S.cfg["items_per_producer"])
    total = np * per

    empty = S.sem(cap, "empty")
    full = S.sem(0, "full")
    mutex = S.sem(1, "mutex")
    buf = S.buffer(cap)

    def producer(pid):
        for i in range(per):
            item = (pid, i)
            S.P(empty)          # 申请一个空槽
            S.P(mutex)          # 互斥访问缓冲区
            buf.put(item)
            S.V(mutex)
            S.V(full)           # 通知消费者：多了一个产品
            S.sleep(1)

    def consumer(cid):
        for _ in range(total // nc):
            S.P(full)           # 申请一个产品
            S.P(mutex)
            item = buf.get()
            S.V(mutex)
            S.V(empty)          # 通知生产者：多了一个空槽
            S.sleep(1)
            S.log("consumer", cid, "got", item)

    for p in range(np):
        S.spawn(producer, p)
    for c in range(nc):
        S.spawn(consumer, c)
