"""参考答案（仅存档，判题不读取本文件）：银行家算法（安全性检查 + 安全序列）。

available 为一维资源向量；max_need / allocation 为 [进程数][资源数] 的二维列表。
need[i] = max_need[i] - allocation[i]。
经典算法：反复寻找满足 need[i] <= work 的【最小下标】进程 i，
令 work += allocation[i] 并将 i 加入安全序列；直到无进程可选。
若序列包含全部进程则安全，否则不安全。
返回 {"safe": bool, "sequence": [已能完成的进程下标...]}（不安全时 sequence 为可完成前缀）。
"""


def solve(available, max_need, allocation):
    n = len(allocation)
    m = len(available)
    work = list(available)
    need = [[max_need[i][j] - allocation[i][j] for j in range(m)] for i in range(n)]
    finish = [False] * n
    sequence = []

    while True:
        found = -1
        for i in range(n):
            if finish[i]:
                continue
            if all(need[i][j] <= work[j] for j in range(m)):
                found = i
                break
        if found == -1:
            break
        for j in range(m):
            work[j] += allocation[found][j]
        finish[found] = True
        sequence.append(found)

    return {"safe": len(sequence) == n, "sequence": sequence}
