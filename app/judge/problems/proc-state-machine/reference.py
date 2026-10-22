"""参考答案（仅存档，判题不读取本文件）：进程状态与转换。

题面口径
--------
对「单个进程」按顺序施加事件串，进程初始状态为「创建」。可用事件及合法转换：

    创建  --admit-->    就绪
    就绪  --dispatch--> 运行
    运行  --timeout-->  就绪
    运行  --wait-->     阻塞
    阻塞  --wakeup-->   就绪
    运行  --exit-->     终止

只要出现一次「当前状态下不允许该事件」的非法转换，立即返回 "ERR"（不再继续处理）。
若事件串全部合法，返回处理结束后的最终状态中文名（创建 / 就绪 / 运行 / 阻塞 / 终止）。
"""

# 状态 -> {事件 -> 目标状态}
_TRANSITIONS = {
    "创建": {"admit": "就绪"},
    "就绪": {"dispatch": "运行"},
    "运行": {"timeout": "就绪", "wait": "阻塞", "exit": "终止"},
    "阻塞": {"wakeup": "就绪"},
    "终止": {},
}


def solve(events):
    state = "创建"
    for ev in events:
        nxt = _TRANSITIONS.get(state, {}).get(ev)
        if nxt is None:
            # 非法转换：立即判错
            return "ERR"
        state = nxt
    return state
