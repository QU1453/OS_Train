# 修改记录（唯一文档）

> 本文件是 `OS_Train` 项目**唯一**的修改记录文档。按用户规则：只维护这一份，找不到才新建；不再新建 v1/v2 副本目录，直接改原文件并在此记录，便于回滚。
> 归档方式：**新条目追加在最上方**（倒序），序号递增。

---

## [19] 重新打包 exe（2026-10-22 21:18）

- 问题：`dist\OS_Train\OS_Train.exe` 停留在 10-21 22:04，本轮 2.4.2 的图解 / 大题 / 判题全未进包。
- 做法：直接跑 `build\build.ps1`（原地覆盖：先 kill `OS_Train`+`QtWebEngineProcess`，删旧 `dist` 与 `build\_work`，再 PyInstaller onedir），**不产生第二个版本**；未改 `os_train.spec`（`ui/` `lessons/` `assets/` 按目录整体拷入，新增文件自动进包）。
- 验证：产物 512.7 MB；包内 `ui\js\qfig\dl-prevent.js`、`app\judge\problems\ordered-alloc\{spec,reference}`、`ui\css\codemirror-theme.css` 均在；包内 `content.html` 的 `data-qfig` 计 12、`qfig/index.js` 已登记 `dl-prevent`；启动 exe 存活 14s 未崩（工作集 191 MB，已生成 `var\progress.db`），测完已结束进程。
- 入口：根目录 `OS_Train.lnk` → `dist\OS_Train\OS_Train.exe`（onedir 必须整目录共存，故顶层放快捷方式）。
- 回滚：无需回滚代码；若需旧包，重跑上一版源码的 `build.ps1` 即可（不保留旧产物）。

---

## [18] 2.4.2 讲义「一个小点一个图解」+ 大题提示/解析图解

- 需求：用户纠正上一轮只做「题目解析」图解 —— 要求讲义正文**每个知识小点各配一个动画/图画**，破坏不可剥夺（做法一/做法二/易错点各一）、破坏请求并保持（途径一/途径二/缺点各一）；简单点用少步骤或静态图；大题提示与答案解析同样要有动画。
- 改动文件：
  - 新增 `ui/js/qfig/dl-prevent.js`（14 图）：`pv-def` / `pv-map` / `pv-mutex` / `pv-nodep-a|b|trap` / `pv-hold-a|b|cost` / `pv-order` / `pv-verdict` / `pv-exam` 为讲义 12 点，`pv-code-hint` / `pv-code-explain` 为大题图解。
  - 修改 `ui/js/qfig/_runtime.js`：`steps(list,{auto:'view'})` 新增视口自动播 —— `IntersectionObserver(threshold .3)` 滚入才播、出视口暂停，`played/touched` 保证只自动播一次且用户点过按钮后视口不再接管。
  - 修改 `ui/js/lesson.js`：新增 `mountQfigs(root)`，`renderLesson` 在 `mountScenes` 之后调用，扫描 `[data-qfig]` 批量 `mount`。
  - 修改 `ui/css/theme.css`：末尾补 `.qfig` 内嵌样式；`.qfig .qf-tbl` 首列放开 `white-space`，修掉正文窄栏下表格顶破版面。
  - 修改 `lessons/ch02/2.4.2/content.html`：12 处 `<div class="qfig" data-qfig="...">` 挂在对应小点之后。
  - 修改 `lessons/ch02/2.4.2/quiz.json`：新增大题 `c1`（`judge_problem_id: ordered-alloc`），`hints` 改为 `{text,fig}` 形态，新增 `explain` + `explain_fig`。
  - 新增 `app/judge/problems/ordered-alloc/{spec.json,reference.py}`：有序分配检查（7 用例）。
  - 修改 `ui/js/editor.js`：`hintsBlock` 兼容字符串/对象两种形态并懒挂图解；新增 `explainBlock()` 与公共 `mountFig()`（动态 import，失败静默降级）。
  - 修改 `ui/css/codemirror-theme.css`：补 `.hints__fig` / `.explain*` 样式。
- 原因 / 取舍：
  - 讲义与题卡共用同一套 `.qf` 运行时不另起炉灶，视觉与 `--sem-*` 变量一致。
  - **滚入视口才播**：一节 12 张图，载入即全播会同时开十几个定时器；视口触发既省资源又符合「跟着读」的节奏。
  - 提示图解懒挂（展开才 import），解析图解直接挂（在题卡下方，滑到即见）。
  - 表格在题目卡里另有宽度，`.qf-tbl` 的通用规则不动，只对 `.qfig` 作用域放开折行，避免影响既有题解。
- 改后行为：进 2.4.2 首屏 `pv-def` 自动播，其余图随滚动逐个播放；大题卡片出现「▸ 查看提示（4）」按钮，展开后挂出 `pv-code-hint`；解析下方直接显示 `pv-code-explain`。
- 验证：
  - `node --check` × 6（`editor/lesson/quiz/qfig-index/qfig-dl-prevent/_runtime`）+ `json.load` × 2 全过。
  - 组件级自检页：14 图全挂、10 个动画的 `STEP x/N` 与字幕条数逐一相等、提示展开前 `0` 展开后 `1`、解析图 `1`、console 仅「qwebchannel 未加载」。
  - **整节渲染自检（stub `ctx.api` 直调 `renderLesson`，走真实 `mountQfigs`）**：`[data-qfig]` 12 → 已挂 12，无空图；14 个 `.qf__stage` 横向溢出全为 0；`hintFig` 0 → 点击后 1（`STEP 1 / 4`）；`explainFig` 1。
  - 大题判题实跑 `python -m app.judge.runner --problem .../ordered-alloc/spec.json --solution .../reference.py`：7 个用例全过，`verdict: pass`（不再出现「卡在运行过程」）。
- 回滚：删 `ui/js/qfig/dl-prevent.js`、`app/judge/problems/ordered-alloc/`；`index.js` 去掉 `dl-prevent` 合并；`_runtime.js` 回退 `steps()` 的 `auto` 分支；`lesson.js` 删 `mountQfigs` 一行与函数；`content.html` 删 12 处挂点；`quiz.json` 删 `c1` 与 `explain*`；`editor.js` 回退 `hintsBlock`、删 `explainBlock/mountFig`；两份 CSS 删新增段。

---

## [17] 题目解析图解系统（qfig）：2.4.1 / 2.4.2 共 15 题接入动画与图表

- 需求：用户「动画太少且做的差，先把题目解析的动画做了；难的用三维或二维、步骤长一点，简单的用图表解析；先做 2.4.1-2、4、2」。
- 改动文件：
  - 新增 `ui/js/qfig/_runtime.js`：`frag()/figure()/chip()/banner()/nodeBox()/arrow()`；`figure()` 返回 `{box, stage, steps(list,{hold,auto})}`，内含「上一步/下一步/自动/重播」播放器与 `MutationObserver` 防定时器泄漏。
  - 新增 `ui/js/qfig/dl-241.js`（8 图）、`ui/js/qfig/dl-242.js`（7 图）、`ui/js/qfig/index.js`（`REG` 合并 + `mount(host,name)`）。
  - 修改 `ui/css/theme.css`：文件末尾追加 `.qf` 图解样式族约 229 行（外壳 / 播放器 / `[data-step]` `[data-off]` `[data-hl]` 三态揭示 / 6 构件 / 6 版式 / 620px 窄屏 / `prefers-reduced-motion`）。
  - 修改 `ui/js/quiz.js`：`explain__body` 之后按 `item.fig` 插入 `.qf-host`，`paint()` 中 `locked` 时懒 `import('./qfig/index.js')` 并 `mount()`，只挂一次。
  - 修改 `lessons/ch02/2.4.1/quiz.json`：7 题各加 `fig`，并补第 8 题（PDF 第 4 章「死锁一定由竞争资源引起」为错）。
  - 修改 `lessons/ch02/2.4.2/quiz.json`：7 题各加 `fig`。
- 原因 / 取舍：
  - **不走 three.js**：题解是 2~6 步的「逐个点亮 / 逐个划掉 / 逐个对照」，3D 建模代价高且文字不可读；用户明确允许「三维**或**二维」。
  - **声明式分步**：`data-step`（第 n 步起常驻）/ `data-off`（第 n 步起灰化淘汰）/ `data-hl`（仅第 n 步高亮），全部由 CSS 过渡驱动，JS 只切 class，无逐帧循环。
  - **两套体系并存**：`scenes/_runtime.js`（WebGL 讲义动画）不动；`qfig/*` 全 DOM，因此可用 `<b>/<u>` 富文本，规避 3D 侧 `textSprite` 不解析 HTML 的老坑。
  - **懒加载**：答题揭晓后才 import，未答题目不产生任何图解 DOM；`content_loader.py` 只 `setdefault`，`fig` 字段天然透传，无需改后端。
- 改后行为：2.4.1（8 题）/ 2.4.2（7 题）答完任一选项后，解析下方出现题解图解；「难」的 5 题（`dl-def` 4 步 / `dl-cond` 6 步 / `dl-necess` 4 步 / `dl-pp-order` 5 步 / `dl-pp-deprive` 6 步含 `data-off`）为可自动播放的分步动画，「简单」的 10 题为一次铺开的对照表 / 因果图 / 泳道图。
- 验证：
  - `node --check` 4 个 js 全过；两份 `quiz.json` 可解析（8 / 7 题）。
  - 起 `http.server` 用浏览器冒烟：15 个 `fig` 名全部命中注册表、零 console 错误；每个动画的 `max(data-step)` 与字幕总步数逐一相等（4/6/4/5/6），`scrollWidth === clientWidth` 无横向溢出；`dl-pp-deprive` 的 `data-off="4"` 在第 4 步正确灰化。
  - 集成冒烟（stub `ctx.api` 直接调 `renderChoices`）：3 张卡 → 3 个 `.qf-host`，点对选项后 `figMounted=1`、`STEP 1 / 4`、`.explain.show` 成立。
  - 冒烟中修掉 1 处内容错误：`dl-241.js` 的 `fCond` 字幕原写「选 A」，而 2.4.1 q2 答案为 B，已改为「选 B」。
- 回滚：删 `ui/js/qfig/` 整个目录与 `theme.css` 末尾 `.qf` 族；`quiz.js` 删 `figHost/mountFig()` 与 `paint()` 里那一行；两份 `quiz.json` 删全部 `fig` 字段（2.4.1 另删 q8）。

---

## [16] 每节讲义内嵌「本节目录」+ 题目分「小题 / 大题」

- 需求：用户「每一小节都应该有个内部小目录，还有题目的话分为大题小题」。
- 改动文件：
  - `ui/js/util.js`：新增导出 `sectionHead({kicker,title,note,major})`，统一题区分区头。
  - `ui/js/lesson.js`：新增 `buildToc()/spy()/squeeze()`，在讲义正文前插入目录；`renderCode` 空数组也交给 `editor.js`（不再提前 return）。
  - `ui/js/quiz.js`：分区头改 `sectionHead({kicker:'小题'})`；题号 `小题 N`。
  - `ui/js/editor.js`：分区头（`kicker:'大题', major:true`）；无大题时渲染虚线空态条；题号 `大题 N`。
  - `ui/css/theme.css`：新增 `.toc*`、`.section-head__kicker(.is-major)`、`.qgroup-empty*`、`.content h2/h3{scroll-margin-top}`。
  - `modify.md`（本条目）。
- 原因 / 取舍：
  - 讲义正文是后端运行时返回的 HTML 字符串，构建期不可解析 → 目录只能运行时扫 `h2,h3` 生成。
  - 29 节标题层级三套并存（h2+h3 / 首 h2 即节名 / 纯 h2）→ 目录**单层平铺**，只用缩进与字号区分 h3，不做折叠；首个 h2 即节名时从目录里移除，避免与页面标题重复。
  - 16 节 `quiz.code` 为空，原 `editor.js` 首行 `if (!list.length) return` 会把「大题」整块吞掉 → 改为渲染空态条，保证「小题 / 大题」成对出现。
  - 复用既有设计：小题青色 = `--accent`，大题琥珀 = `--sem-key`（与既有 `.prob-head__no` 同源），未新增色板。
- 改后行为：每节正文上方出现「CONTENTS 本节目录」两列索引（点击平滑跳转、滚动高亮、宽度 <760px 自动单列）；题区固定为「小题 · 选择题」→「大题 · 代码大题」两段，题号分别以 `小题 N` / `大题 N` 开头；无大题的节显示 `[ 大 ] 本节只设小题（选择题），暂未安排大题。`
- 验证：`node --check` 4 个文件通过；用真实 MainWindow 脚本（`var/_verify_toc.py` 等，验收后已删）实测 2.4.2 / 2.4.3 / 2.1.1 / 1.1：目录均渲染且为两列（272px×2）、`errs=[]`、2.4.2 首 h2 去重后 5 项、滚到 55% 高亮跳到末节、小题/大题徽标齐备、2.4.2 空态文案正确；静态扫描 29 节 h2+h3 均 ≥5（无节缺目录）。
- 视觉微调：`.toc::before` 左标尺由 `3px` 两段渐变（末端全透明，显得上实下断）改为 `2px` + `border-radius:1px` + 三段渐变（0% accent → 46% 0.42 → 100% 0.16）。
- 打包：`build\build.ps1` 通过，`dist\OS_Train\OS_Train.exe` 512.5 MB；5 个改动文件与源码哈希逐一相等；启动 exe 窗口正常、`QtWebEngineProcess` 正常拉起。
- 回滚：删 `theme.css` 上述四组规则；`lesson.js` 删 `buildToc/squeeze` 与 `renderLesson` 中 4 行目录调用、`renderCode` 恢复 `if (!items.length) return;`；`quiz.js`/`editor.js` 分区头恢复手写 `el('div',{class:'section-head'})`、题号恢复 `Q{n}`/`代码题 {n}`；`util.js` 删 `sectionHead`。

---

## [15] 3D 动画补全至 29/29 + 判题不再卡在「正在编译并运行」+ Ctrl+S 保存

- 改动文件：
  - 新增场景（21 个）：`ui/js/scenes/` 下 `os-concept/os-evolution/os-structure/os-boot/os-vm/os-map`（第 1 章）、`proc-concept/proc-control/proc-ipc/thread-model`、`sched-levels/sched-switch/sched-metrics`、`crit-section/mutex-impl/sem-sync/reader-writer/monitor`、`deadlock-intro/deadlock-prevent/ch2-map`
  - 修改：`ui/js/scenes/index.js`（`LOADERS` 由 8 项扩至 29 项）
  - 修改：`ui/js/scenes/_runtime.js`（导出 `retext()` 供各场景复用精灵贴图）
  - 修改：`ui/css/theme.css`（新增 `.scene-tip` 字幕条样式）
  - 修改：`app/judge/launcher.py`（`_stall` 12s 无输出看门狗 + `_guard` 超时兜底 + `_fail_finish()`）
  - 修改：`ui/js/judge_panel.js`（4 路信号 + `settle()` 幂等收口 + `armGuard()` 150s 前端兜底）
  - 修改：`ui/js/editor.js`（`Ctrl+S`/`Cmd+S` 立即落盘 + toast 反馈）
  - 新增工具：`var/wire_scenes.py`（批量接线）、`var/_inv2.py`（29 节覆盖验收）
  - 修改：`modify.md`（本条目）
- 需求：题库涉及章节（第 1、2 章共 29 节）全部配生动三维动画且每节有题；修复大题「一直停在正在编译并运行」；补 `Ctrl+S` 保存。
- 原因（是否有更优方案、是否必要）：
  - 三项均必要。29 节中 [10] 只覆盖了 8 个最易错点，其余 21 节是纯文字，不满足「大部分采用三维动画」的要求。
  - **判题卡死为何是三层兜底而非单点修**：卡死可能发生在（a）子进程起来了但不输出、（b）子进程永不退出、（c）信号在前端丢失。任一层单修都留有死角，故 launcher 侧加「12s 无输出即判失败」「`timeout+6s` 强制收尾」，前端再加 150s `armGuard()`，且 `settle()` 幂等保证无论几路信号先到都只结算一次。
  - **Ctrl+S 为何不只在 CodeMirror 的 `extraKeys` 里加**：面板内两个编辑区（py/c）与外层卡片都可能持有焦点，故在 `panes` 上用捕获阶段监听 + 卡片冒泡兜底，两条路径都走同一个 `onHotkey`，避免「在第二个编辑器里按没反应」。
  - **建模取舍**：统一用 `SceneHost`（相机/渲染/dispose 复用）+ `toolbar` 四模式互斥 + `onTick` 状态机，不逐节重写渲染循环；文字一律 `textSprite`/`retext`，避免每帧重建 canvas 贴图。
- 改后行为：29 节每节首屏均有可拖动三维演示，四个按钮互斥切换并联动字幕；判题无论成功/失败/超时都会在有限时间内给出结论；编辑器内 `Ctrl+S` 立即保存并提示。
- 验证：
  - `node --check` 31 个文件（29 场景 + `_runtime.js` + `index.js`）全部通过；`python var\_inv2.py` 输出 `3D_COVERED 29 / 29`（29 节 quiz 均 6~9 题）。
  - 浏览器冒烟（`var/scene_test.html`，固定 1000×520 再缩放，避免窄窗口裁切）：2/2 场景 canvas 均挂载，`__errors=[]` 零 JS 异常；截图目视确认 `deadlock-prevent`（四柱+锤子+说明）与 `ch2-map`（中心核心+四分支+轨道）构图完整。
  - 冒烟中发现并修复 2 处缺陷（详见下方「追加修复」）。
- 追加修复（浏览器冒烟暴露，均已进包）：
  - `deadlock-prevent.js`：`NOTES` 含 `<strong>`，而 `textSprite`/`retext` 是 canvas 绘制、不解析 HTML，导致画面出现字面量标签。加 `const plain = (s) => s.replace(/<[^>]+>/g, '')`，精灵路径统一过 `plain()`；`host.cap()` 是 DOM，保留原 HTML。
  - `deadlock-prevent.js`：`const btns = host.toolbar([... pick(btns[0])])` 存在 TDZ（`pick` 后声明，若构造期触发 `onClick` 即 `Cannot access 'pick' before initialization`）。改为 `let btns = []` → 先声明 `pick` → 再 `btns = host.toolbar(...)`。**同类坑在 `ch2-map.js` 已出现一次，后续 `toolbar` 一律「先 helper、后赋值」。**
  - 通用规则：`label()/hint()/cap()` 吃 HTML；`textSprite()/retext()` 不吃，凡传入含标签的文案必须先剥标签。
- 回滚方法：全部为原地修改。删除上述 21 个场景文件并把 `index.js` 的 `LOADERS` 恢复为 8 项即可回退动画；`launcher.py`、`judge_panel.js`、`editor.js` 按本条「改后行为」前的旧逻辑复原；`theme.css` 删 `.scene-tip` 规则、`_runtime.js` 删 `retext` 导出；最后删除本条目 `[15]` 并重新打包。

---

## [14] 停止键修复 + 判题提速 + 启动进度条等待界面

- 改动文件：
  - 新增：`app/splash.py`（带进度条的启动等待界面；浅色设计令牌与 `theme.css` 对齐）
  - 修改：`app/main.py`（先立 splash 再懒加载重窗口；`ready` 接线 + 25s 兜底）
  - 修改：`app/window.py`（新增 `ready` 信号与 `progress` 回调，上报构建里程碑）
  - 修改：`app/judge/launcher.py`（`cancel()` 非阻塞杀进程树 + 保证 Settle 信号必达）
  - 修改：`app/judge/runner.py`（并发判题遇硬失败提前结束，限制失败重复轮数）
  - 修改：`ui/js/editor.js`、`ui/js/judge_panel.js`、`ui/css/codemirror-theme.css`（停止按钮即时反馈 + 「已停止」态样式）
  - 修改：`modify.md`（本条目）
- 需求：用户反馈「编译运行得太慢了，停止键按了还没用，exe 程序打开的时候加个有进度条的等待界面」。
- 原因（是否有更优方案、是否必要）：
  - 三项均必要，属直接影响可用性的缺陷/缺口。
  - 停止键：原 `cancel()` 在主线程同步等子进程退出，且 Settle 信号可能丢失 → 界面卡死、按钮无响应，改为**非阻塞**终止并保证 `settled` 必达（前端另有 900ms 兜底恢复按钮态）。
  - 提速：并发判题在明确失败时仍跑满 15 轮，纯属浪费；改为硬失败（死锁/加载失败）**提前结束**并限制失败重复轮数（`max_fail_repeats` 默认 2），载荷加 `ran_runs` 便于查看实际轮数。
  - 等待界面：exe 启动需先导入 QtWebEngine、起本地服务、渲染页面（约 4~5s），无反馈易被误认为卡死。**为何不走 `QSplashScreen`**：需先 import `QtWidgets` 才能建，而耗时的正是 QtWebEngine 的导入与页面渲染；自绘无边框窗口可在最早期立起来。**进度上报为何带 `processEvents()`**：构建是**同步**的，不主动刷新则进度条不会重绘。页面渲染约 2.3s 且不可细分，故该步用**不确定进度（-1）**动画避免「假死」观感；另设 25s 兜底 `QTimer` 保证等待界面必定消失（`finish()` 幂等）。
- 改后行为：
  - 启动即显示浅色卡片式等待界面（标题/版本/状态文案 + 进度条），依次上报「准备运行环境 10% → 加载图形组件 24% → 本地服务 38% → 进度数据库 50% → 判题引擎 60% → 构建界面 72% → 渲染课程界面（不确定）→ 准备就绪 100%」，随后淡出（150ms）并显示主窗口。
  - 停止判题可立即生效，按钮即时回到可用态，结果区显示「已停止」。
  - 死锁等失败用例秒级返回（实测 4.07s，仅跑 1 轮即判定 fail）；正确解仍跑满 15 轮满分（1.05s）。
- 验证：
  - 开发期冒烟脚本：`READY at 4.44s`，进度标记按序到达且无卡顿。
  - 重新打包后冻结 exe 自检：死锁解 `exit=0 4.07s → fail, ran_runs=1`；参考解 `exit=0 1.05s → pass, score=100, 15/15`（与修复前相比未回归）。
- 回滚方法：
  - 删除 `app/splash.py`；`app/main.py` 去掉 splash 相关代码（恢复直接构造 `MainWindow` 并 `win.show()`）；`app/window.py` 去掉 `ready` 信号与 `_report`/`progress` 参数；`app/judge/launcher.py`、`app/judge/runner.py`、`ui/js/editor.js`、`ui/js/judge_panel.js`、`ui/css/codemirror-theme.css` 按本条「改后行为」前的旧逻辑复原。全部为**原地修改**、无多版本副本。回滚后重新打包覆盖 `dist\OS_Train` 即可；最后删除本条目 `[14]`。

---

## [13] 界面配色由深色改为浅色（Editorial Light）

- 改动文件：
  - 重写：`ui/css/theme.css`（深色 "Editorial Dark" → 浅色 "Monospace-driven Editorial Light"，`<style>` 语义分工与排版规则不变）
  - 重写：`ui/css/codemirror-theme.css`（VSCode **Dark+** → VSCode **Light+** 语法配色）
  - 修改：`ui/js/scenes/_runtime.js`（3D 运行时：调色板回退值、半球光、文字精灵默认色、立方体描边、地面网格默认色）
  - 修改：`ui/js/scenes/{dining-philosophers,deadlock-detect,semaphore-pv,banker,sched-algorithms,producer-consumer,proc-states,kernel-mode}.js`（共 24 处文字精灵底板由深色改为浅色）
  - 修改：`modify.md`（本条目）
- 需求：用户以 `trae-remote-official:frontend-design` 提出「改成浅色调」——此要求**取代**最初「深色调」的设定。
- 原因（是否有更优方案、是否必要）：
  - 必要（用户明确需求）。深色是早期设定，现要求改为浅色。
  - **为何从「设计令牌层」入手而非逐处改色**：全站配色集中在 `theme.css` 的 `:root` CSS 变量，且 3D 场景通过 `getComputedStyle` 读同一批变量（`_runtime.js::cssVar/palette`）。因此**先翻转 `:root` 令牌**，3D 主体的语义色（accent/def/key/warn/memo/exam/ok/err）即自动跟随，无需逐文件硬编码。
  - 更优方案评估：(a) 仅改 `theme.css`——不足以覆盖 `codemirror-theme.css` 里 20 余处硬编码深色与 8 个场景文件里的 24 处深色精灵底板，会残留「深色补丁」；(b) 整站重做组件——无必要、风险大。故采用「令牌层翻转 + 收口残余硬编码」的最小必要改动。
  - **代码编辑器主题类名决策**：CodeMirror 的主题类名由 `ui/js/editor.js` 的 `theme:'osdark'` 生成（`.cm-s-osdark`）。为**避免牵动 JS 逻辑、降低联动风险**，保留类名 `.cm-s-osdark` 不动，仅把其配色换成浅色（文件中已加注释说明）。
  - **浅色下的可见性修正**：立方体描边原为白色（`0xffffff`，透明度 0.16），在浅色底上几乎不可见，改为深色 `0x1F2430`、透明度 0.14；地面网格原为深色低透明（0.32）在白底上过淡，改为浅灰网格（中心线 `#b9c4d1`、格线 `#dbe2ea`）并提高不透明度至 0.9；半球光由「冷灰天顶 + 近黑地面」改为「白天顶 + 浅灰地面」。
- 改后行为：
  - 应用底色 `#F2F4F7`、卡片 `#FFFFFF`、正文 `#16202B`；强调色由亮青 `#35E0C8` 改为深青 `#0B7D6F`（保证白底可读），并新增 `--accent-hover`、`--editor-bg`、`--editor-gutter` 三个令牌；`color-scheme: light`。
  - 代码编辑器为白底 VSCode Light+ 语法配色**（不同语义字符仍有不同颜色）：注释绿 `#008000`、关键字蓝 `#0000FF`、控制流洋红 `#AF00DB`、字符串 `#A31515`、数字 `#098658`、函数 `#795E26`、变量 `#001080`、类型/内置 `#267F99`**——满足「像 VSCode 一样按功能区分颜色」的原始要求。
  - 3D 场景：浅色画布 + 白天顶/浅灰地面光照 + 浅灰地面网格；所有标注精灵底板由 `rgba(9,13,18,…)` 改为 `rgba(255,255,255,…)`，深色文字落在浅色底板上。
- 验证：
  - 静态检查：全仓 `ui/` 已无 `#0d1117 / #0b0f14 / #04231f / rgba(53,224,200 / rgba(255,92,92 … )` 等深色残留；`ui/js/**` 仅存语义令牌与浅色值（`ui/vendor/three/*` 为第三方库，未改）；24 处旧底板全部替换为对应浅色（Grep 计数 0 → 24）。
  - 运行验证：重新打包 `dist\OS_Train` 后启动 exe，逐课点选「3D 演示」与「练习-代码题」，确认浅色渲染正常（见下方重建记录）。
- 回滚方法：本条目涉及 4 类文件均为**原地重写/替换**，无多版本副本。回滚时将 `ui/css/theme.css`、`ui/css/codemirror-theme.css`、`ui/js/scenes/_runtime.js` 及 8 个场景文件按本次改动前的深色值复原（深色基准值见各文件顶部注释与本条目的「改前色值」记述），然后**重新打包**覆盖 `dist\OS_Train` 即可；同时删除本条目 `[13]`。

---

## [12] 在项目根目录添加入口快捷方式 `OS_Train.lnk`

- 改动文件：
  - 新增：`OS_Train.lnk`（项目根目录，指向 `dist\OS_Train\OS_Train.exe`）
  - 修改：`modify.md`（本条目）
  - 修改：`README.md`（在「快速开始」补一句：根目录双击 `OS_Train.lnk` 即可）
- 需求：用户反馈「把 exe 放在最上层，不要让我找半天」——原入口在 `dist\OS_Train\OS_Train.exe`，需逐层进入 `dist` 才能找到。
- 原因（是否有更优方案、是否必要）：
  - 必要（易用性）。原路径层级较深，日常启动不便。
  - **为何不能直接把 exe 单独挪到根目录**：本程序是 PyInstaller **onedir 扁平布局**，`OS_Train.exe` 依赖**与其同目录**的 `PySide6\`、`ui\`、`lessons\`、`assets\`、`app\judge\problems\` 等（冻结后 `app_root()==resource_root()==exe 所在目录`）。单独移动 exe 会立即启动失败；把整个产物目录内容摊到项目根又会与源码目录 `app/ ui/ lessons/ assets/` 冲突并污染根目录。故**物理文件不动**。
  - 更优方案评估：(a) 生成一个**真正的启动器 exe**——需额外编译，且与用户「exe 只保留一份、不建多版本」的原则相悖，否决；(b) 用 `.bat` 启动——会有黑框闪现、观感差；(c) **Windows 快捷方式 `.lnk`**——零成本、无黑框、双击即用、在资源管理器中与 exe 图标一致，且不产生第二个程序副本。选 (c)。
  - 关于相对路径：曾尝试把 `.lnk` 的目标写成相对路径 `dist\OS_Train\OS_Train.exe` 以求「移动文件夹后仍有效」，但 WScript.Shell 会把它错误解析成 `C:\dist\OS_Train\OS_Train.exe`（相对当前工作目录而非 .lnk 所在目录）。故改用**绝对路径**目标。据此，**若日后移动/重命名项目文件夹，需重新生成该快捷方式**（重建命令见下）。
- 改后行为：
  - 项目根目录出现 `OS_Train.lnk`；双击即启动程序，工作目录已设为 `dist\OS_Train`（保证相对资源与 `var\` 定位正确），图标取自 exe 自身。
  - 生成命令（PowerShell）：
    ```powershell
    $r='<项目根>'; $lnk=Join-Path $r 'OS_Train.lnk'; $exe=Join-Path $r 'dist\OS_Train\OS_Train.exe'
    $ws=New-Object -ComObject WScript.Shell; $sc=$ws.CreateShortcut($lnk)
    $sc.TargetPath=$exe; $sc.WorkingDirectory=(Join-Path $r 'dist\OS_Train')
    $sc.Description='OS_Train 操作系统复习（进程管理篇）'; $sc.IconLocation="$exe,0"; $sc.Save()
    ```
- 验证：
  - `TargetPath = D:\...\OS_Train\dist\OS_Train\OS_Train.exe`、`Test-Path` 目标返回 True；
  - 双击（等价于 `Start-Process OS_Train.lnk`）后：`exe running: True  ws=282MB`、`QtWebEngineProcess=1`、无 `startup.log` 错误 ⇒ 快捷方式可正常拉起程序。
- 回滚方法：删除项目根目录下的 `OS_Train.lnk` 即可（不影响程序本体与打包产物）；同时删除本条目 `[12]`。

---

## [11] 修复冻结后 GUI 启动崩溃（PyInstaller 误收集 Anaconda 的 ICU 73 DLL）+ 打包验证通过

- 改动文件：
  - 修改：`build/os_train.spec`（新增 `_keep_binary()` 二进制裁剪，从 `a.binaries` 中剔除所有 `icu*.dll`）
  - 修改：`modify.md`（本条目）
  - 清理（非功能改动）：删除工作区诊断残留 `.cache/diag/`、`build/_tmp/{diag_qt.py,judge_out.txt,judge_err.txt}`，以及源码与产物中的 `app/**/__pycache__/`（含 `app/`、`app/judge/`、`app/judge/problems/*/`）
- 现象（改前行为）：
  - 打包产物 `dist\OS_Train\OS_Train.exe` 双击后**窗口一闪即退**，GUI 完全起不来；`dist\OS_Train\var\log\startup.log` 记录：
    `File "main.py", line 73, in <module>` → `File "main.py", line 49, in main` →
    `ImportError: DLL load failed while importing QtCore: 找不到指定的程序。`
  - 同一份源码在开发期 venv（`.venv\Scripts\python.exe app\main.py`）里运行完全正常，说明是**冻结/收集阶段**引入的问题，而非代码或 PySide6 二进制损坏。
- 根因定位（证据链）：
  1. 依赖闭包扫描（`probe5.py`，对 `dist\OS_Train\PySide6\QtCore.pyd` 按「模块目录→System32→产物根→PATH」顺序重演加载器搜索）报：
     `SHADOWED icuuc.dll -> C:\Windows\System32\icuuc.dll (frozen copy: dist\OS_Train\icuuc.dll) [needed by qt6core.dll]`。
  2. 二进制比对：`PySide6\Qt6Core.dll`、`QtCore.pyd`、`pyside6.abi3.dll`、`shiboken6\shiboken6.abi3.dll` 在 venv 与 dist 中 **MD5 完全一致** ⇒ 排除文件损坏，确认为环境性问题。
  3. ICU 版本对照：产物根目录**独有** `icuuc.dll`（2,744,832 B，**v73.1.0.0**）+ `icudt73.dll`（32,001,536 B）；而 venv 中**根本没有任何 ICU**（PySide6 轮子不附带 ICU），venv 运行时由 `C:\Windows\System32\icuuc.dll`（**v72.1.0.4**，36,864 B）满足依赖。
  4. PATH 溯源：本机 PATH 上的 Anaconda（`D:\Application\ToolsInComputer\anaconda\Library\bin`）带有 ICU **73**；PyInstaller 依赖分析在解析 `Qt6Core.dll` 对 `icuuc.dll` 的导入时按 PATH 命中它，遂收集进产物。
  - 结论：PySide6 6.11 的 `Qt6Core.dll` 按 **ICU 72** 构建（ICU 导出符号带版本后缀，如 `u_strlen_72`）。产物里一旦带上 **ICU 73**，Windows 加载器优先命中它，而它不含 `_72` 符号 → `ERROR_PROC_NOT_FOUND`（WinError 127）=「找不到指定的程序」。
- 改后行为：
  - `build/os_train.spec` 在数据裁剪块之后、`PYZ` 之前新增：
    ```python
    _BAD_BIN_PREFIX = "icu"
    _BAD_BIN_SUFFIX = ".dll"

    def _keep_binary(dest: str) -> bool:
        name = os.path.basename((dest or "").replace("\\", "/")).lower()
        if name.startswith(_BAD_BIN_PREFIX) and name.endswith(_BAD_BIN_SUFFIX):
            return False
        return True

    a.binaries = [t for t in a.binaries if _keep_binary(t[0])]
    ```
    即把一切 `icu*.dll` 从产物二进制中剔除，让 `Qt6Core.dll` 回落到与 venv 完全一致的 System32 ICU 72。venv 本就无 ICU，因此**不引入任何缺失依赖**。
  - 重新打包后：产物 **545.6 MB → 512.6 MB**（减少约 33 MB，即被误收的 ICU 体积）；全树搜索 `icu*.dll` 已为空（仅剩 `PySide6\resources\icudtl.dat`，那是 QtWebEngine 自带的数据文件、非 DLL，保留）。
- 验证（两次，均通过）：
  1. 快速验证（不重打包）：从旧产物中手工删除 `icuuc.dll`+`icudt73.dll`、清空 `startup.log` 后启动 → `exe alive: True  ws=244MB`、`QtWebEngineProcess count: 1`、`startup.log <none>`、stderr 为空 ⇒ 修复方向正确。
  2. 完整重建（先清理残留进程，再 `build\build.ps1`）后：
     - GUI 启动：`exe alive: True  ws=184MB`、`QtWebEngineProcess=1`、`startup.log <none>`；
     - 判题子进程（冻结 exe 内）：`{"type":"done","verdict":"pass","score":100,"passed_runs":15,"total_runs":15}`（15/15 全部通过，未发现静态/并发错误）。
- 原因（是否有更优方案、是否必要）：
  - 必要。这是**阻断性**缺陷：不修则打包产物完全不可用（GUI 无法启动），而用户交付物正是 Windows 桌面 exe。
  - 更优方案评估：曾考虑 (a) 在 `build.ps1` 构建前临时收窄 PATH（`$env:PATH` 去掉 Anaconda）——治标不治本，且依赖构建环境、换机器易复发；(b) 把 System32 的 ICU 72 显式拷进产物——但 PySide6 轮子本身不带 ICU，等于人为多带一份本可由系统提供的 DLL，体积与控制都更差；(c) 在 spec 的 `binaries` 过滤——**最贴近「与 venv 行为一致」的原则**，只做减法、不新增文件、与运行环境解耦。故选 (c)。
  - 附带确认：GUI 启动时沙箱曾告警 NVIDIA/Chromium 写 C 盘 GPU 缓存（`C:\ProgramData\NVIDIA Corporation\...`、`...\local\NVIDIA\DXCache\*.nvph`、`...\spool\drivers\color\sRGB Color Space Profile.icm`）。经查 `app\bootstrap.py:69-75` 已用 `--disk-cache-dir`/`--user-data-dir` 把 WebEngine 自身状态改到 D 盘，`app\window.py:85-92` 亦另设 `setCachePath`/`setPersistentStoragePath`；上列命中的均为**显卡驱动侧**缓存，非本应用代码所致，应用侧维持「零 C 盘写入」最佳努力，不做额外改动。
- 回滚方法：
  - 删除 `build/os_train.spec` 中的 `_BAD_BIN_PREFIX/_BAD_BIN_SUFFIX/_keep_binary` 定义与 `a.binaries = [t for t in a.binaries if _keep_binary(t[0])]` 一行，然后重新执行 `build\build.ps1` 即可（回滚后产物会重新带上 ICU DLL，在本机将再次出现启动崩溃，仅当换到无非-72 ICU 的干净构建机时才适宜回滚）。
  - 删除本条目 `[11]`。清理动作无需回滚（诊断残留本就不应留在仓库）。

---

## [10] 全部 8 个三维动画场景模块落地 + 修正 2.4.3 例题 Work 向量算术

- 改动文件：
  - 新增：`ui/js/scenes/kernel-mode.js`（1.2.2 内核态与用户态）
  - 新增：`ui/js/scenes/proc-states.js`（2.1.2 进程状态与转换）
  - 新增：`ui/js/scenes/sched-algorithms.js`（2.2.4 FCFS/SJF/HRRN 调度对比）
  - 新增：`ui/js/scenes/semaphore-pv.js`（2.3.3 信号量 P/V 原语）
  - 新增：`ui/js/scenes/producer-consumer.js`（2.3.5 生产者-消费者有界缓冲区）
  - 新增：`ui/js/scenes/dining-philosophers.js`（2.3.7 哲学家进餐与死锁）
  - 新增：`ui/js/scenes/banker.js`（2.4.3 银行家算法安全性检查）
  - 新增：`ui/js/scenes/deadlock-detect.js`（2.4.4 资源分配图化简检测）
  - 修改：`lessons/ch02/2.4.3/content.html`（例题 Work 向量推进算术修正）
  - 修改：`modify.md`（本条目）
- 改前行为 / 改后行为：
  - 改前：知识点正文中的「难点」缺少可视化，只有静态文字与公式。
  - 改后：每节课的 `content.html` 通过 `<div class="scene" data-scene="…"></div>` 挂载三维动画，8 个场景全部实现，`ui/js/scenes/index.js` 的 `LOADERS` 早已登记全部 8 个名字，**无需再改注册表**。
  - 场景统一约定：`SceneHost` + `toolbar()` + `onTick()` + `cap()/hint()` 外壳；颜色全部取自 `theme.css` 语义变量（`--accent/--sem-def/--sem-key/--sem-warn/--sem-memo/--sem-exam/--ok/--err`）；文字用 `retext()` 复用 sprite（换 `material.map` 并 dispose 旧图，避免重建）；指数趋近插值 `x = lerp(x, target, 1 - Math.pow(k, dt))`；逐材质淡出记录 `m.userData.bop = m.opacity` 后动画 `m.opacity = bop*k`。
  - `deadlock-detect.js` 关键设计：两个预设拓扑同构、都含环 `P1→R2→P2→R1→P1`，**仅 R1 实例数不同**（2 ⇒ 可完全化简/无死锁；1 ⇒ 不可化简/死锁），用于直接演示「环路只是必要条件」。化简轨迹已手工验证：可化简 ⇒ P2→P1→P3 全部消去；死锁 ⇒ 仅 P3 可消去，P1/P2 卡死。
  - `content.html` 修正：2.4.3 例题 Work 向量推进序列由错误值改为 `3 3 2 → 5 3 2 → 7 4 3 → 7 5 3 → 10 5 5 → 10 5 7`。
- 原因（是否有更优方案、是否必要）：
  - 必要：用户明确要求「难理解的部分要有 3 维动画演示」，且要求「一节一节完成」。8 个场景对应第 1、2 章最易错的 8 个知识点，属核心交付内容。
  - 更优方案评估：曾考虑每节各写独立动画脚本，但会大量重复相机、resize、dispose 逻辑；最终统一抽到 `_runtime.js` 的 `SceneHost` + 绘制助手，各场景只写数据与步进逻辑，显著降低重复且便于统一配色。银行家算法与死锁检测共享「安全性/化简步进」结构，已按同一模板实现以便对照记忆。
  - 未新增场景注册：`scenes/index.js` 的 `LOADERS` 已含 8 个名字，故不重复改动，避免无意义变更。
- 回滚方法：
  - 删除上述 8 个新增的 `ui/js/scenes/*.js` 即可让场景回退（`index.js` 中对应名称会加载失败，可一并回滚该文件的 `LOADERS` 项）。
  - 还原 `lessons/ch02/2.4.3/content.html` 中 Work 向量序列为改前值即可回滚该处修正。
  - 删除本条目 `[10]`。

---

## [9] 第 2 章 13 个「代码节」内容落地 + 修复判题并发抖动在 Windows 上的超时误判（`harness.py`）

- 改动文件：
  - 新增：`lessons/ch02/{2.1.2,2.1.3,2.2.3,2.2.4,2.3.2,2.3.3,2.3.4,2.3.5,2.3.6,2.3.7,2.3.8,2.4.3,2.4.4}/{lesson.json,content.html,quiz.json}`（共 13 节；每节含知识点正文 + 选择题 + 写代码大题，大题的 `python_reference` 通过 `judge_problem_id` 绑定可运行判题题目）
  - 修改：`app/judge/harness.py`（`_jitter()` 改为平台自适应；新增 `import os`）
  - 修改：`modify.md`（本条目）
- 13 节与绑定判题题目（`quiz.code[0].judge_problem_id`）：
  - 2.1.2 进程的状态与转换 → `proc-state-machine`（deterministic）
  - 2.1.3 进程控制 → `process-control`（deterministic）
  - 2.2.3 调度评价指标 → `sched-metrics`（deterministic）
  - 2.2.4 调度算法（FCFS/SJF/HRRN） → `sched-algorithms`（deterministic）
  - 2.3.2 临界区互斥·标志法 → `critical-section-flag`（deterministic）
  - 2.3.3 信号量机制·PV 实现互斥 → `semaphore-basic`（concurrency）
  - 2.3.4 信号量·同步与互斥综合 → `sem-sync-mutex`（concurrency）
  - 2.3.5 生产者—消费者 → `pc-bounded-buffer`（concurrency）
  - 2.3.6 读者—写者 → `rw-reader-writer`（concurrency）
  - 2.3.7 哲学家进餐 → `dining-philosophers`（concurrency）
  - 2.3.8 管程实现有界缓冲区 → `monitor-bounded-buffer`（deterministic）
  - 2.4.3 银行家算法 → `banker-algorithm`（deterministic）
  - 2.4.4 死锁检测 → `deadlock-detection`（deterministic）
- 改前行为 / 改后行为：
  - 改前：第 2 章仅有 9 个概念节的正文与选择题；13 个「代码节」无正文、无大题，且并发 PV 大题无法稳定判题（见下）。
  - 改后：13 个代码节均具备完整正文（语义标签白名单内）+ 选择题 + 写代码大题；大题参考答案可一键判题，13 项全部 `pass`。
- 修复：判题并发抖动在 Windows 上导致「正确解」被误判超时
  - 现象：`2.3.3 semaphore-basic` 参考解 15 次运行全部 `0/15`，失败不变式为 `no_deadlock`，原因 `finished=False`（「死锁/超时」）。
  - 定位：`_jitter()` 原实现 `time.sleep(random.uniform(0, 0.0006))`；Windows 默认定时器粒度约 15.6 ms，任何亚毫秒 `sleep` 都会实际阻塞约一个时钟滴答（实测 `time.sleep(0.0003)` ≈ 15.5 ms/次）。参考解单次运行因此耗时约 14.97 s，远超 `run_timeout_sec=3.0`，被误报为死锁；解本身完全正确（counter 480/480、`cs` 峰值 1、无重叠）。
  - 改法：`_jitter()` 平台自适应 —— Windows 上用 `time.sleep(0)`（仍强制让出时间片、保留竞争窗口），非 Windows 保留细粒度随机 `sleep`。
  - 影响面：仅 `app/judge/harness.py` 一个函数；所有 `kind=concurrency` 题目共用。
- 原因（是否有更优方案、是否必要）：
  - 必要。用户要求「每节都要有练习题（选择 + 写代码大题）」且代码大题要能运行判题；13 节正文与大题是交付主体，`_jitter` 缺陷会使所有基于 `S.counter`/`S.buffer` 的并发大题在 Windows 上误判。
  - 关键决策自检（是否有更优解 / 是否必要）：
    - 13 节沿用既有 `lesson.json/quiz.json` 契约与语义标签白名单，不新增字段、不改 `content_loader.py`，扩展成本最低。
    - `_jitter` 修复选择「Windows 用 `time.sleep(0)`」而非「调整随机区间」或「提高 `run_timeout_sec`」：提高超时只是掩盖问题、且拖慢每次判题；`sleep(0)` 经多题 × 15 次交叉验证，正确解由「超时」变为 ~0.06 s 通过，且**错误解仍被稳定捕获**（`no_lost_update`/`no_concurrent`/`liveness` 全命中），无更优方案。
  - 验证：`validate_refs.py` 对 13 个题目逐一运行参考解 → `total code items = 13, not-passing = 0`（`semaphore-basic` 现为 `15/15`）。
- 回滚方法：
  - 恢复 `app/judge/harness.py` 的 `_jitter()` 为 `time.sleep(random.uniform(lo, hi))` 并移除新增的 `import os`（或 `git checkout` 该文件）；如同时回滚 13 节，删除 `lessons/ch02/{2.1.2,2.1.3,2.2.3,2.2.4,2.3.2,2.3.3,2.3.4,2.3.5,2.3.6,2.3.7,2.3.8,2.4.3,2.4.4}` 13 个目录；最后删除本条目。判题题目本身不删，回滚仅影响本节正文与大题。

---

## [8] 第 2 章 9 个概念节内容落地（2.1.1 / 2.1.4 / 2.1.5 / 2.2.1 / 2.2.2 / 2.3.1 / 2.4.1 / 2.4.2 / 2.4.5）

- 改动文件（仅新增节目录，未修改任何既有文件）：
  - 新增：`lessons/ch02/2.1.1/{lesson.json,content.html,quiz.json}`（进程的概念和特征）
  - 新增：`lessons/ch02/2.1.4/...`（进程通信）
  - 新增：`lessons/ch02/2.1.5/...`（线程的概念与多线程模型）
  - 新增：`lessons/ch02/2.2.1/...`（调度的概念与层次）
  - 新增：`lessons/ch02/2.2.2/...`（进程调度的时机、切换与过程、方式）
  - 新增：`lessons/ch02/2.3.1/...`（同步与互斥的基本概念）
  - 新增：`lessons/ch02/2.4.1/...`（死锁的概念）
  - 新增：`lessons/ch02/2.4.2/...`（死锁预防）
  - 新增：`lessons/ch02/2.4.5/...`（本章小结与真题精讲）
  - 修改：`modify.md`（本条目；并顺带修正了并发写入产生的重复序号 `[5]/[5]` → `[5]/[6]/[7]`，使倒序序号严格递减）
- 改前行为 / 改后行为：
  - 改前：第 2 章 22 节中仅 `catalog.json` 有条目骨架，无任何 `content.html/quiz.json`，章节无法在应用内浏览、无练习题。
  - 改后：新增 9 个概念/真题节（均为 `tags` 不含 `代码` 的节，`quiz.code` 为空），每节 7–8 道选择题（含题干/选项/答案/解析），内容 HTML 遵循既有语义标签白名单（`<h2>/<h3>/<p>/<ul>/<ol>/<li>/<strong>/<em>/<code>/<pre>/<table>/<blockquote>` 与 `class` 白名单）。
- 原因（是否有更优方案、是否必要）：
  - 必要。用户要求「一节一节完成」，先补齐无需判题后端的纯概念节，可快速把第 2 章骨架填实，且不与判题后端耦合。
  - 关键决策自检：9 节按考点聚类并行编写（进程概念组 / 调度概念组 / 同步概念组 / 死锁概念组 / 小结），统一沿用 1.1 节的 `lesson.json/quiz.json` 契约，不新增字段、不改 `content_loader.py` 白名单，扩展成本最低，无更优方案。
- 回滚方法：
  - 删除上述 9 个 `lessons/ch02/<id>/` 目录，并删除本条目。回滚后第 2 章恢复为仅骨架、无内容状态，其余功能不受影响。

---

## [7] 判题后端再新增 4 个确定性（deterministic）判题题目（进程状态 / 进程控制 / 调度指标 / 调度算法）

- 改动文件（仅新增题目目录 + 本记录）：
  - 新增：`app/judge/problems/proc-state-machine/spec.json`、`reference.py`（进程状态与转换；入口 `solve(events)`；`compare=exact`；6 个用例，含 3 个非法转换）
  - 新增：`app/judge/problems/process-control/spec.json`、`reference.py`（进程控制·就绪队列/阻塞集合模拟；入口 `solve(ops)`；`compare=exact`；6 个用例）
  - 新增：`app/judge/problems/sched-metrics/spec.json`、`reference.py`（调度评价指标：平均周转/带权周转/等待；入口 `solve(jobs)`；`compare=numeric`，`tol=0.01`；5 个用例）
  - 新增：`app/judge/problems/sched-algorithms/spec.json`、`reference.py`（FCFS / SJF / HRRN 非抢占执行顺序；入口 `solve(jobs, algo)`；`compare=exact`；5 个用例，覆盖三种算法）
  - 修改：`modify.md`（本条目）
- 改前行为 / 改后行为：
  - 改前：`app/judge/problems/` 下仅有 `pc-bounded-buffer`、`rw-reader-writer` 两个 `kind=concurrency` 题目；进程状态、进程控制、调度类考点无 `deterministic` 题面可用。
  - 改后：新增 4 个 `kind=deterministic` 题目，覆盖第 2 章「进程状态与转换、进程控制、调度评价指标、调度算法」四个高频考点；判题器按 `arg_names` 注入入参、逐用例比对 `expected`，返回 `verdict/score/summary/cases`。
- 原因（是否有更优方案、是否必要）：
  - 必要。用户明确要求为判题后端新增这 4 个确定性题目；补齐后上述考点才有可运行判题。
  - 关键决策自检（都是否有更优解 / 是否必要）：
    - 全部沿用既有 `spec.json` 契约（`entry/arg_names/compare/tol/cases`），不新增字段、不改 `runner.py`，扩展成本最低，无更优方案。
    - `proc-state-machine`：非法转换「一旦出现立即返回 ERR」，避免二义性，返回值唯一。
    - `process-control`：`block` 先出队再入阻塞集合、`wakeup` 仅当在阻塞集合时才回队尾、`exit` 双清；规则明确、结果唯一。
    - `sched-metrics`：按「给定顺序」非抢占执行（非按到达排序），`start=max(当前时间, 到达)`；用 `numeric` 容差 0.01 规避浮点问题。
    - `sched-algorithms`：SJF 并列按（服务升、到达升、输入序），HRRN 按（响应比降、服务升、输入序），并专门构造 `F(arr0,svc15)/L(arr1,svc10)/S(arr14,svc1)` 用例，使 SJF 选 S、HRRN 选 L，验证两算法方向差异。
  - 自测中修正 1 处：`sched-metrics` 用例 5（首作业晚到达）手算 `avg_waiting` 误写 6.0，实测为 `16/3≈5.33`，已把 `expected.avg_waiting` 由 6.0 改为 5.33 后复跑通过（其余用例未改动）。
  - 验证：对 4 个题目依次运行
    `.\.venv\Scripts\python.exe app\main.py --judge --problem app\judge\problems\<id>\spec.json --solution app\judge\problems\<id>\reference.py`
    结果：4 题全部 `verdict=pass, score=100`（proc-state-machine 6/6、process-control 6/6、sched-metrics 5/5、sched-algorithms 5/5）。
- 回滚方法：
  - 删除 `app/judge/problems/proc-state-machine/`、`process-control/`、`sched-metrics/`、`sched-algorithms/` 四个目录；并删除本条目。不涉及任何既有代码文件，回滚后判题后端行为与新增前一致。

---

## [6] 判题后端新增 4 个确定性（deterministic）判题题目

- 改动文件（仅新增，未修改任何既有文件）：
  - 新增：`app/judge/problems/critical-section-flag/spec.json`、`reference.py`（临界区互斥·标志法操作序列模拟；入口 `solve(ops)`；6 个用例，结果 1 或 2）
  - 新增：`app/judge/problems/monitor-bounded-buffer/spec.json`、`reference.py`（管程实现有界缓冲区；入口 `solve(ops, capacity)`；5 个用例）
  - 新增：`app/judge/problems/banker-algorithm/spec.json`、`reference.py`（银行家算法安全性检查；入口 `solve(available, max_need, allocation)`；6 个用例，含 408 经典数据）
  - 新增：`app/judge/problems/deadlock-detection/spec.json`、`reference.py`（死锁检测·资源分配图可完全化简；入口 `solve(available, allocation, request)`；6 个用例）
- 改前行为 / 改后行为：
  - 改前：`app/judge/problems/` 下仅有 `pc-bounded-buffer`、`rw-reader-writer` 两个 `kind=concurrency` 题目，`judge_deterministic` 分支无任何题面可用。
  - 改后：新增 4 个 `kind=deterministic` 题目，覆盖进程同步（标志法/管程）与死锁（银行家算法/死锁检测）两大高频考点；判题器按 `arg_names` 注入入参、逐用例比对 `expected`，返回 `verdict/score/summary/cases`。
- 原因（是否有更优方案、是否必要）：
  - 必要。用户明确要求为判题后端补齐 4 个确定性题目，补齐后 `deterministic` 判题范式才有实际题面可跑，且这 4 题是 408 高频大题。
  - 关键决策自检：
    - 全部沿用既有 `spec.json` 契约（`entry/arg_names/compare/tol/cases`），不新增字段、不改 `runner.py`，扩展成本最低。
    - `banker-algorithm` / `deadlock-detection` 的返回均设计为**与扫描顺序无关**：银行家按「最小下标」规则产生**唯一**安全序列；死锁检测返回**升序**的未完成下标（可完成集合是最小不动点，与扫描顺序无关），因此 `expected` 确定唯一、可精确比对。
    - 每个用例的 `expected` 均经手工推演核对（银行家／死锁检测为「sched 无关」算法，已逐条手算验证）后再由 `--judge` 实测确认。
  - 验证：对 4 个题目依次运行
    `.\.venv\Scripts\python.exe app\main.py --judge --problem app\judge\problems\<id>\spec.json --solution app\judge\problems\<id>\reference.py`
    结果：4 题全部 `verdict=pass, score=100`（critical-section-flag 6/6、monitor-bounded-buffer 5/5、banker-algorithm 6/6、deadlock-detection 6/6）。
- 回滚方法：
  - 删除 `app/judge/problems/critical-section-flag/`、`monitor-bounded-buffer/`、`banker-algorithm/`、`deadlock-detection/` 四个目录即可；不涉及任何既有文件，回滚后判题后端行为与新增前完全一致。

---

## [5] 判题题库扩展：新增 3 道【并发 concurrency】大题（信号量互斥 / 信号量同步互斥 / 哲学家进餐）

- 改动文件：
  - 新增：`app/judge/problems/semaphore-basic/spec.json`、`app/judge/problems/semaphore-basic/reference.py`
  - 新增：`app/judge/problems/sem-sync-mutex/spec.json`、`app/judge/problems/sem-sync-mutex/reference.py`
  - 新增：`app/judge/problems/dining-philosophers/spec.json`、`app/judge/problems/dining-philosophers/reference.py`
  - 新增（临时反例，未入库）：`.cache/diag/bad_philosophers.py`
  - 未改动 `harness.py` / `invariants.py` / `runner.py` 及任何其它已有文件。
- 各题要点：
  - `semaphore-basic`「信号量机制：用 PV 实现临界区互斥」：config `{n_procs:4, incs_per_proc:120, exclusive_labels:["cs"], require_regions:["cs"]}`；不变式 `no_error/no_lost_update/no_concurrent/no_deadlock`；参考解 `mutex=S.sem(1)` + 共享 `S.counter`，每进程循环 120 次 `P(mutex)→S.enter("cs")→count.inc()→S.exit("cs")→V(mutex)`。
  - `sem-sync-mutex`「用信号量实现同步与互斥（单缓冲生产者—消费者）」：config `{capacity:1, n_producers:1, n_consumers:1, items_per_producer:12, expected_total:12}`；不变式 `no_error/no_overflow/no_underflow/no_lost_update/liveness/no_deadlock`；参考解 `empty=1/full=0/mutex=1` + `S.buffer(1)`，生产 `P(empty)→P(mutex)→put→V(mutex)→V(full)`，消费 `P(full)→P(mutex)→get→V(mutex)→V(empty)`。
  - `dining-philosophers`「哲学家进餐问题（避免死锁）」：config `{n_philosophers:5, rounds:3, exclusive_labels:["fork0".."fork4"], conflict_labels:[], require_regions:["eat","fork0".."fork4"]}`；不变式 `no_error/no_concurrent/no_deadlock`；参考解用 5 个 `S.sem(1,"forki")`，偶数号先左后右、奇数号先右后左（破坏循环等待，等价于资源有序分配），取到叉子即 `S.enter("forki")`、放下前 `S.exit("forki")`，两叉到手 `S.enter("eat")→S.sleep(2)→S.exit("eat")`，每人重复 rounds 轮。
- 改前行为 / 改后行为：
  - 改前：并发判题题库仅有生产者—消费者、读者—写者等题，缺乏「单一互斥临界区」「信号量同步互斥」「哲学家进餐」三个第 2 章核心考点的可运行判题题目。
  - 改后：新增 3 个可运行判题题目（`kind=concurrency`）；判题后端无需改动即可按各自 `config` 中的 `exclusive_labels/require_regions/expected_total` 校验互斥、同步、丢失更新与死锁。
- 原因（是否有更优方案、是否必要）：
  - 必要。用户要求为判题后端新增这 3 道并发题；三者分别覆盖「PV 实现互斥」「信号量实现同步+互斥」「死锁避免」三个高频大题，仅靠配置声明即可复用现有 harness，无更省成本的方案。
  - 关键决策自检：
    - 哲学家参考解采用「奇数号打乱取叉顺序」而非「至多 4 人同时取叉」的额外信号量方案：前者纯用 5 把叉子信号量即可，对 5 把叉子存在一致的全局取用序（偶数 i→i+1、奇数 i+1→i 无环），等价资源有序分配，确定无死锁，更贴合教材。
    - 反例 `.cache/diag/bad_philosophers.py` 在「先取左叉」后加入短暂停顿，以稳定复现「5 人各持左叉、永久等待右叉」的教科书死锁交错，避免依赖运气导致偶发不触发。
  - 验证（连跑 3 次）：
    - `semaphore-basic/reference.py` → 3/3 次均 `pass, 15/15`。
    - `sem-sync-mutex/reference.py` → 3/3 次均 `pass, 15/15`。
    - `dining-philosophers/reference.py` → 3/3 次均 `pass, 15/15`。
    - 反例 `dining-philosophers` + `.cache/diag/bad_philosophers.py` → `fail, 0/15`：`no_deadlock` 命中「死锁/超时：部分线程在超时时间内没有结束」（finished=False），并伴随 `no_concurrent` 命中「未检测到进入互斥区「eat」」（因死锁导致无人能进餐）。
- 回滚方法：
  - 删除 `app/judge/problems/semaphore-basic/`、`app/judge/problems/sem-sync-mutex/`、`app/judge/problems/dining-philosophers/` 三个整目录，以及临时反例 `.cache/diag/bad_philosophers.py`。回滚后判题题库恢复为新增前的题目集合，其余功能不受影响。

---

## [4] 判题能力扩展：标签互斥区 + 非原子共享计数器 + `no_concurrent` 不变式（支撑读者—写者/哲学家等同步大题）

- 改动文件：
  - 修改：`app/judge/harness.py`（新增 `Counter` 类；`Harness.__init__` 新增 `_regions/_region_peak/_overlaps/_exclusive/_conflicts/_counters`；新增 `enter(label)/exit(label)/counter(initial,name)`；新增 `counters/region_overlaps` 属性与 `region_peak(label)` 方法；模块文档串补 `S.enter/S.exit/S.counter`）
  - 修改：`app/judge/invariants.py`（新增 `no_concurrent` 不变式；扩展 `no_lost_update` 遍历 `h.counters` 检测丢失更新；文档串更新）
  - 新增：`app/judge/problems/rw-reader-writer/spec.json`（kind=concurrency；4 读者 / 2 写者 / 读者各 3 轮 / 写者各 6 轮；`exclusive_labels:["write"]`、`conflict_labels:[["read","write"]]`、`require_regions:["read","write"]`；15 轮 3.0s；4 条不变式）
  - 新增：`app/judge/problems/rw-reader-writer/reference.py`（读者优先参考解：rmutex / wmutex / readcount）
  - 新增（临时反例，未入库）：`.cache/diag/bad_rw.py`、`.cache/diag/bad_rw2.py`
- 改前行为 / 改后行为：
  - 改前：harness 只插桩有界缓冲区的 put/get，判题器只能对生产者—消费者类题目判并发；读者—写者、哲学家进餐等题（互斥/同步对象形态不同）无法运行判题。
  - 改后：harness 支持任意「标签互斥区」（`S.enter/S.exit`）、跨标签冲突检测（`conflict_labels`，如读—写互斥）与非原子共享计数器（`S.counter`，`.inc/.dec` 故意不加锁，缺互斥即暴露为丢失更新）；新增 `no_concurrent` 不变式可同时校验区内互斥与读写冲突。
- 原因（是否有更优方案、是否必要）：
  - 必要。用户明确要求「代码大题要能运行判题」，而第 2 章第 2.3.5/2.3.6/2.3.7 等核心节（读者—写者、哲学家）属高频大题，若判题器只认生产者—消费者则这些节无法判题。
  - 关键决策自检：
    - 采用「标签 + 配置声明互斥/冲突对」而非给每题写专用 harness：题目只需在 `spec.json` 声明 `exclusive_labels/conflict_labels/require_regions`，判题后端无需改动，扩展成本最低。
    - `enter()` 检测到重叠只「记录消息」不抛异常（与 `Buffer._enter` 抛错不同）：保证整轮能跑完并在 `run_result` 集中回显，避免学生因一次瞬时重叠就中断、看不到全貌。
    - 计数器 `inc/dec` 故意非原子并插入抖动，使「忘记给 readcount 加锁」这一经典错误在 15 轮内稳定复现为 `no_lost_update`。
  - 验证（三组对照）：
    - 回归：`pc-bounded-buffer` → `pass, 100, 15/15`（旧题不受影响）。
    - 正例：`rw-reader-writer/reference.py` → `pass, 100, 15/15`。
    - 反例 A：`.cache/diag/bad_rw.py`（完全无互斥）→ `fail, 0, 0/15`，`no_concurrent` 命中「访问冲突：read 区与 write 区同时有进程在执行」。
    - 反例 B：`.cache/diag/bad_rw2.py`（写者互斥正确、readcount 未加 rmutex）→ `fail, 0, 0/15`，`no_lost_update` 命中「共享变量「readcount」发生丢失更新：应有 0，实际 -3」。
- 回滚方法：
  - 还原 `app/judge/harness.py`（删 `Counter` 类、`__init__` 中新增的 6 个字段、`enter/exit/counter` 三个方法、`counters/region_overlaps` 属性与 `region_peak` 方法），还原 `app/judge/invariants.py`（删 `no_concurrent`、还原 `no_lost_update`），删除 `app/judge/problems/rw-reader-writer/` 整目录。回滚后仅剩生产者—消费者一题可判并发，其余功能不受影响。

---

## [3] 阶段 4 前端落地：代码编辑器（CodeMirror 5）+ 判题面板 + 首个可运行判题（生产者—消费者）

- 改动文件：
  - 新增：`ui/js/editor.js`（代码大题区：C 参考 / Python 参考 / Python 作答 三个标签页，CM5 高亮，草稿还原 + 700ms 防抖自动保存，运行/停止按钮接线到 `ctx.api.judgeRun` / `judgeCancel`，无 CM 时降级为 `<textarea class="cm-fallback">`）
  - 新增：`ui/js/judge_panel.js`（判题结果面板：`createJudgeView()`，单次订阅 `judgeStarted/judgeEvent/judgeFinished/judgeFailed` 四个信号并只路由给「当前活跃」面板；同时渲染确定性流（case_start/case_result/case_trace/done）与并发流（run_start/run_result/done），失败时展开证据块与末 40 行日志）
  - 新增：`app/judge/problems/pc-bounded-buffer/spec.json`（kind=concurrency，容量 4 / 2 生产者 / 2 消费者 / 各 12 项 / 期望总量 24，15 轮 3.0s，6 条不变式）
  - 新增：`app/judge/problems/pc-bounded-buffer/reference.py`（信号量 + 互斥 + 有界缓冲区的参考解，仅用于出题自测，判题器不读取它）
  - 修改：`ui/css/codemirror-theme.css`（补 `.judge-panel [hidden]` / `.run-strip[hidden]` / `.hints__list[hidden]` 强制隐藏、`.cm-fallback` 文本框样式、`.judge-summary:empty` 收起、`.judge-count` 计数样式）
- 改前行为 / 改后行为：
  - 改前：`ui/js/lesson.js` 动态 `import('./editor.js')` 失败，代码大题区只显示占位面板「代码编辑器与沙箱判题模块尚未接入」；`app/judge/problems/` 目录为空，判题器没有任何可用题目。
  - 改后：代码大题区可正常渲染多标签页编辑器（VSCode 式按 token 着色）、草稿自动保存与恢复、一键运行/停止判题；判题事件（逐用例、逐轮次、交错轨迹、不变式明细）实时流式回显；`pc-bounded-buffer` 经命令行实测 15/15 轮全过、6 条不变式全 ok。
- 原因（是否有更优方案、是否必要）：
  - 必要。用户明确要求「练习题里输入代码的部分要像 vscode 一样按功能着色」「代码大题要能运行判题」。此条目补齐 `lesson.js` 已声明但缺失的 `editor.js`/`judge_panel.js` 契约，属阻断性缺口（无此文件则第 2 章所有代码节均无法作答）。
  - 关键决策自检：
    - 判题只对 Python 生效、参考答案用 C 展示（贴合 408 写法），已在界面标注；不自建 C 编译链（TCC）是更优取舍（构建复杂度/风险 vs 收益）。
    - 编辑器沿用 CodeMirror 5（UMD，离线无坑）而非 CM6（仅 ESM）；并保留 `<textarea>` 降级，避免 vendor 缺失时整页不可用。
    - 判题面板采用「单次订阅 + 活跃面板路由」，因后端已强制同时只允许一个判题在跑，避免多面板重复渲染同一事件流。
  - 验证：`\.venv\Scripts\python.exe app\main.py --judge --problem app\judge\problems\pc-bounded-buffer\spec.json --solution app\judge\problems\pc-bounded-buffer\reference.py` 返回 `verdict=pass, score=100, passed_runs=15/15`，`summary="连续 15 轮全部通过，未发现竞态/死锁。"`。该命令与 `judge/__init__.py::build_command()` 在 dev 模式下生成的完全一致。
- 回滚方法：
  - 删除 `ui/js/editor.js`、`ui/js/judge_panel.js`、`app/judge/problems/pc-bounded-buffer/`（整目录）；还原 `ui/css/codemirror-theme.css`（移除本条目新增的四段规则）。回滚后代码大题区回到「占位面板」状态，判题器无题可用，其余功能不受影响。

---

## [2] 修复启动崩溃：PySide6 QtCore DLL 加载失败（WinError 127，被同机同名 Qt6 DLL 抢占）

- 改动文件：
  - 修改：`app/bootstrap.py`（在 `configure()` 末尾新增调用 `preload_qt_dlls()`；新增私有函数 `_qt_dll_dirs()`、`preload_qt_dlls()`）
- 改前行为 / 改后行为：
  - 改前：启动即崩，`import PySide6.QtCore` 抛 `ImportError: DLL load failed while importing QtCore: 找不到指定的程序。`（WinError 127 = ERROR_PROC_NOT_FOUND），窗口完全打不开。
  - 改后：启动正常。窗口标题 `操作系统复习 · 进程与调度（内存管理之前） - 操作系统复习`，回环 HTTP `127.0.0.1:<port>/` 返回 200。
- 原因（是否有更优方案、是否必要）：
  - 必要，属阻断性缺陷。根因（经子进程隔离复现 + 六种策略对照验证）：
    1. `PySide6\__init__.py` 只把 `shiboken6` 目录加入 `os.add_dll_directory`，而把 `PySide6` 自身目录仅写入 `PATH`；Python 3.8+ 解析扩展模块依赖时**不再走 PATH**，故 `QtCore.pyd` 的依赖 `pyside6.abi3.dll` 按默认搜索顺序解析时找不到正确副本。
    2. 本机 PATH 上有两份无关 Qt6：`STM32CubeProgrammer\bin` 与 `anaconda\Library\bin`，含同名 `Qt6Core.dll` 等，导致绑定到错误副本并报「找不到指定的程序」。
  - 修复方式：在 `bootstrap.configure()`（即任何 Qt 导入之前）用 `LoadLibraryExW(..., LOAD_WITH_ALTERED_SEARCH_PATH=0x8)` 预加载 `shiboken6.abi3.dll` → `pyside6.abi3.dll` → `Qt6Core.dll`（取自 PySide6 自身目录），使其先入进程，后续 import 按基名绑定到正确模块。
  - 为何不选其他方案（更优性核对）：
    - 仅清理 `PATH`（剔除两份外来 Qt6）→ 实测仍失败，不足以解决，故不采用。
    - 仅 `os.add_dll_directory` → 实测在同进程内看似生效，但子进程全新解释器下仍失败（属「已加载」假象），故不采用。
    - 预加载 VC 运行库 → 属误判线索，实测无效，故不采用。
    - 改动 PySide6 包内 `__init__.py` → 侵入第三方包、升级即失效，故不采用。
    - 现方案改动仅限本项目 `bootstrap.py`、在任何 Qt 导入前执行、失败静默降级，最优。
  - 验证：`final_probe.py` 中对 `QtCore/QtGui/QtWidgets/QtNetwork/QtWebChannel/QtWebEngineCore/QtWebEngineWidgets` 七个模块全部导入成功，`qVersion: 6.11.2`；随后真机启动通过。
- 回滚方法：
  - 还原 `app/bootstrap.py`：删去 `configure()` 末尾的 `preload_qt_dlls()` 调用及新加的 `preload_qt_dlls()`、`_qt_dll_dirs()` 两个函数，即回到修改前状态（启动将重新崩溃，故一般无需回滚）。

---

## [1] 前端框架与视觉系统落地（阶段 2）：路由外壳、课程总目录、选择判分、错题本、笔记自动保存

- 改动文件：
  - 新增：`ui/js/app.js`（ESM 入口：握手、hash 路由 `#/ | #/lesson/<ch>/<id> | #/wrong`、侧栏渲染、总进度、导出/导入弹窗、`ctx` 注入、NATIVE_ONLY 致命兜底）
  - 新增：`ui/js/home.js`（课程总目录首页：hero + 图例 + 章节分块 + 29 张课节卡，含标签与进度环）
  - 新增：`ui/js/quiz.js`（选择题渲染 + 判分 → `answerChoice`/`setChoiceScore`；错题落库 `addWrong`/`clearWrong`）
  - 新增：`ui/js/lesson.js`（单课页：正文 HTML、场景挂载、选择题、代码大题的接线占位、笔记防抖自动保存、标记完成/重置）
  - 新增：`ui/js/wrongbook.js`（错题本视图）
  - 修改：`ui/css/theme.css`（追加 `.legend`、`.tag--*`、`.wrong-*`、`.modal*`、`.json-area`、`input[type=file]`；替换无效的 `#reveal` 规则为 `.sidebar-collapsed` 与 `.nav.no-anim`）
- 改前行为 / 改后行为：
  - 改前：`ui/index.html` 引用了 `/ui/js/app.js` 但该文件不存在，页面脚本图无法解析，打开即空白（仅 vendor 资源齐全）。
  - 改后：页面可从原生桥接拉取目录与进度，渲染「课程总目录」列出全部 29 节课（未写内容的显示 `待写` 徽标），支持进入单课、做选择题并即时判分、错题自动进错题本、笔记自动保存、导出/导入进度。
- 原因（是否有更优方案、是否必要）：
  - 必要。阶段 2 是所有内容页面的承载层；先跑通「路由 + 保存 + 判分」主干，后续逐节内容才能挂载。
  - 关键决策：`lesson.js` 对尚未实现的 `./scenes/index.js`（3D）与 `./editor.js`（编辑器/判题）采用 `try/catch` 动态导入 + 降级面板，避免阶段 4/5 未完成时整页报错；导航动画仅在首渲染播放（`navAnimated` → `.nav.no-anim`），避免每次答题都重放。
  - 已核对 `app/bridge.py` 全部 @Slot 签名后再接线，无方法名/参数漂移。
- 回滚方法：
  - 删除上述 5 个新增的 `ui/js/*.js`，并还原 `ui/css/theme.css`（移除本条目追加的样式、恢复原 `#reveal` 段）。回滚后页面回到「index.html 引用缺失 app.js」状态，即阶段 2 之前。

---

## [0] 基线：工程骨架与判题子系统首次落地（阶段 0 / 阶段 1 / 阶段 4 后端）

- 改动文件：
  - `app/main.py`、`app/bootstrap.py`、`app/window.py`、`app/local_server.py`
  - `app/bridge.py`、`app/content_loader.py`、`app/progress.py`、`app/__init__.py`
  - `app/judge/__init__.py`、`harness.py`、`invariants.py`、`sandbox.py`、`runner.py`、`launcher.py`
  - `lessons/catalog.json`
  - `ui/vendor/qwebchannel.js`（从 npm 包 `qwebchannel` 获取的 Qt 官方客户端）
  - `.venv/`（D 盘虚拟环境）、`requirements.txt`、`tools/fetch_vendor.ps1`、`setup_env.ps1` 等环境脚本
  - `ui/vendor/codemirror/*`、`ui/vendor/three/*`、`assets/fonts/*`
- 改前行为 / 改后行为：
  - 改前：空目录，无任何代码。
  - 改后：具备可运行的 PySide6 外壳（loopback HTTP + QWebChannel）、SQLite 进度存储、内容加载器，以及完整的判题子系统（确定性判题 + 插桩并发判题）后端；前端 `ui/` 仅含 vendor 资源。
- 原因（是否有更优方案、是否必要）：
  - 必要。按已批准计划 `.trae/documents/os-review-desktop-app-plan.md` 分阶段落地。
  - 关键决策回顾：打包用 PyInstaller **onedir**（避免 `--onefile` 解压到 C 盘 `%TEMP%`，违反用户规则）；页面用 **loopback HTTP** 而非 `file://`（`file://` 下 Chromium 禁 ESM/fetch，three.js 新版只能 ESM）；编辑器选 **CodeMirror 5**（UMD，离线无坑）而非 CM6（仅 ESM）。
- 回滚方法：
  - 本条目为初始基线，回滚即删除上述文件并清空 `.venv`；`modify.md` 本身保留。
  - 环境回滚：删除 `d:\Users\13310\Desktop\desktop_folder\Project_All\OS_Train\.venv` 后重跑 `setup_env.ps1`。

---

## 记录模板（新增条目请复制以下结构，序号递增，置于本模板上方）

```
## [N] 一句话标题
- 改动文件：
- 改前行为 / 改后行为：
- 原因（是否有更优方案、是否必要）：
- 回滚方法：
```
