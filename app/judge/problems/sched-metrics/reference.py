"""参考答案（仅存档，判题不读取本文件）：调度算法评价指标计算。

题面口径
--------
jobs = [{"name": "A", "arrival": 0, "service": 4}, ...]。

按【给定顺序】非抢占地依次执行（一次只运行一个作业），维护当前时间 t（初值 0）：

    start  = max(t, arrival)
    finish = start + service
    turnaround         = finish - arrival
    weighted_turnaround = turnaround / service
    waiting            = turnaround - service      # 等价于 start - arrival
    t = finish

返回三项平均值：
    {"avg_turnaround": ..., "avg_weighted_turnaround": ..., "avg_waiting": ...}
"""


def solve(jobs):
    t = 0.0
    n = len(jobs)
    sum_turn = 0.0
    sum_weighted = 0.0
    sum_wait = 0.0

    for job in jobs:
        arrival = job["arrival"]
        service = job["service"]

        start = max(t, arrival)
        finish = start + service
        turnaround = finish - arrival

        sum_turn += turnaround
        sum_weighted += turnaround / service
        sum_wait += turnaround - service

        t = finish

    return {
        "avg_turnaround": sum_turn / n,
        "avg_weighted_turnaround": sum_weighted / n,
        "avg_waiting": sum_wait / n,
    }
