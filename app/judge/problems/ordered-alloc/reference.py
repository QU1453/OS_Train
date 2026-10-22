"""参考答案（仅存档，判题不读取本文件）：资源有序分配法合规检查。

rank    资源名列表，下标 + 1 即编号
held    二维列表，held[i] 为进程 i 已持有的资源名
request 二维列表，request[i] 为进程 i 本次申请的资源名

规则：进程已持资源的最大编号为基准（空手取 0），
      申请编号 < 基准即违反「只能按编号递增申请」。
返回：违规进程下标列表，升序。
"""


def solve(rank, held, request):
    no = {name: i + 1 for i, name in enumerate(rank)}
    bad = []
    for i, req in enumerate(request):
        base = max((no[r] for r in held[i]), default=0)
        if any(no[r] < base for r in req):
            bad.append(i)
    return sorted(bad)
