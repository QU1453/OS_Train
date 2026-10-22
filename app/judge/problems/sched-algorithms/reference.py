"""参考答案（仅存档，判题不读取本文件）：调度算法（FCFS / SJF / HRRN）。

题面口径
--------
jobs = [{"name": "A", "arrival": 0, "service": 4}, ...]；algo ∈ {"FCFS", "SJF", "HRRN"}。
非抢占式：一次只运行一个作业直到完成；每次在「当前时刻已经到达」的未完成作业中选一个执行。
若当前时刻没有已到达的作业，则时间推进到剩余作业中最早的到达时刻。

选择规则（均以输入下标作为最终并列判据，下标小者优先）：
    FCFS  选到达时间最早者（并列按输入顺序）
    SJF   选服务时间最短者（并列按到达早、再按输入顺序）
    HRRN  选响应比 (等待 + 服务) / 服务 最大者（并列按服务短、再按输入顺序）
         其中 等待 = 当前时刻 - 到达时间

返回按执行先后排列的 name 列表。
"""


def solve(jobs, algo):
    n = len(jobs)
    done = [False] * n
    order = []
    t = 0

    for _ in range(n):
        # 当前已到达且未完成的作业
        avail = [i for i in range(n) if not done[i] and jobs[i]["arrival"] <= t]
        if not avail:
            # 时间推进到最早到达的作业
            t = min(jobs[i]["arrival"] for i in range(n) if not done[i])
            avail = [i for i in range(n) if not done[i] and jobs[i]["arrival"] <= t]

        if algo == "FCFS":
            pick = min(avail, key=lambda i: (jobs[i]["arrival"], i))
        elif algo == "SJF":
            pick = min(avail, key=lambda i: (jobs[i]["service"], jobs[i]["arrival"], i))
        elif algo == "HRRN":
            def hrrn_key(i):
                j = jobs[i]
                wait = t - j["arrival"]
                ratio = (wait + j["service"]) / j["service"]
                # 响应比大者优先；并列取服务短；再并列取输入靠前
                return (ratio, -j["service"], -i)

            pick = max(avail, key=hrrn_key)
        else:
            raise ValueError(f"未知调度算法：{algo}")

        done[pick] = True
        order.append(jobs[pick]["name"])
        t = max(t, jobs[pick]["arrival"]) + jobs[pick]["service"]

    return order
