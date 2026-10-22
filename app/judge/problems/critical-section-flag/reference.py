"""参考答案（仅存档，判题不读取本文件）：临界区互斥——标志法操作序列模拟。

按题目要求「无阻塞、严格按顺序执行」逐条执行操作序列：
维护 flag=[False, False]、in_cs=0、max_cs=0；
  "i:set"   -> flag[i] = True
  "i:clear" -> flag[i] = False
  "i:enter" -> in_cs += 1 并更新 max_cs
  "i:exit"  -> in_cs -= 1
返回临界区内同时存在的最大进程数 max_cs（int）。
"""


def solve(ops):
    flag = [False, False]
    in_cs = 0
    max_cs = 0
    for op in ops:
        idx_str, action = op.split(":")
        i = int(idx_str)
        if action == "set":
            flag[i] = True
        elif action == "clear":
            flag[i] = False
        elif action == "enter":
            in_cs += 1
            if in_cs > max_cs:
                max_cs = in_cs
        elif action == "exit":
            in_cs -= 1
    return max_cs
