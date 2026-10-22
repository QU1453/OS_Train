"""参考答案（仅存档，判题不读取本文件）：进程控制（就绪队列与阻塞队列）。

题面口径
--------
输入 ops 为字符串列表，每条形如 "<命令> <pid>"：

    create <pid>  将 pid 追加到「就绪队列」队尾
    block  <pid>  将 pid 从就绪队列移除，并放入「阻塞集合」
    wakeup <pid>  将 pid 从阻塞集合移除，并追加到就绪队列队尾；
                  若该 pid 当前不在阻塞集合中，则忽略该操作
    exit   <pid>  将 pid 从就绪队列与阻塞集合中都移除

所有操作按 ops 顺序依次执行，最后返回「就绪队列」中的 pid 列表（保持先后顺序）。
"""


def solve(ops):
    ready = []          # 就绪队列（有序）
    blocked = set()     # 阻塞集合

    for op in ops:
        parts = op.split()
        if not parts:
            continue
        cmd = parts[0]
        pid = parts[1] if len(parts) > 1 else None

        if cmd == "create":
            ready.append(pid)
        elif cmd == "block":
            if pid in ready:
                ready.remove(pid)
            blocked.add(pid)
        elif cmd == "wakeup":
            if pid in blocked:
                blocked.discard(pid)
                ready.append(pid)
        elif cmd == "exit":
            if pid in ready:
                ready.remove(pid)
            blocked.discard(pid)

    return ready
