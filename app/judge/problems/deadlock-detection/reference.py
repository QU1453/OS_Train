"""参考答案（仅存档，判题不读取本文件）：死锁检测（资源分配图可完全化简）。

available 一维；allocation / request 二维 [进程数][资源数]，need = request（额外请求量）。
算法：work = available；反复找出满足 request[i] <= work 的未完成进程 i，
令 work += allocation[i] 并标记完成；重复直到无进展。
返回最终【未完成（死锁）】的进程下标列表，升序。
"""


def solve(available, allocation, request):
    n = len(allocation)
    m = len(available)
    work = list(available)
    finish = [False] * n

    while True:
        progressed = False
        for i in range(n):
            if finish[i]:
                continue
            if all(request[i][j] <= work[j] for j in range(m)):
                for j in range(m):
                    work[j] += allocation[i][j]
                finish[i] = True
                progressed = True
                break
        if not progressed:
            break

    return sorted(i for i in range(n) if not finish[i])
