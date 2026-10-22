"""参考答案（仅存档，判题不读取本文件）：管程实现有界缓冲区。

单线程按顺序模拟管程（管程天然互斥）：维护 buffer、wait_producers、wait_consumers、consumed。
  produce：若 len(buffer) >= capacity，生产者进入 notfull 条件等待（wait_producers 追加该数据），
           否则 buffer 尾部追加。
  consume：若 buffer 为空，消费者进入 notempty 条件等待（wait_consumers 追加 1），
           否则从 buffer 头部取出并追加到 consumed。
每次操作后：先尽量唤醒等待的生产者（buffer 未满则从 wait_producers 取一个追加到 buffer 尾部），
再尽量唤醒等待的消费者（buffer 非空则 buffer.pop(0) 追加到 consumed 并从 wait_consumers 取一个）。
返回 {"consumed": [...], "buffer": [...], "waited": len(wait_producers) + len(wait_consumers)}。
"""


def solve(ops, capacity):
    buffer = []
    wait_producers = []
    wait_consumers = []
    consumed = []

    for op in ops:
        kind = op[0]
        if kind == "produce":
            data = op[1]
            if len(buffer) >= capacity:
                wait_producers.append(data)
            else:
                buffer.append(data)
        elif kind == "consume":
            if not buffer:
                wait_consumers.append(1)
            else:
                consumed.append(buffer.pop(0))

        while wait_producers and len(buffer) < capacity:
            buffer.append(wait_producers.pop(0))
        while wait_consumers and buffer:
            consumed.append(buffer.pop(0))
            wait_consumers.pop(0)

    return {
        "consumed": consumed,
        "buffer": buffer,
        "waited": len(wait_producers) + len(wait_consumers),
    }
