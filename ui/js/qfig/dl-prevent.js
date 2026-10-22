/**
 * qfig/dl-prevent.js —— 2.4.2 死锁预防：讲义知识点内嵌图解
 *
 * 与 dl-242.js（题目解析）分工不同：
 *   dl-pp-*  → 答题揭晓后出现的题解
 *   pv-*     → 直接嵌在 content.html 里，一个知识小点一张图
 *
 * 简单概念用静态图表（opts 不带 steps），多跳推理用分步动画；
 * 讲义一页会嵌十几张，所以动画统一 auto:'view'（滚入视口才播）。
 */
import { figure, frag } from './_runtime.js';

const K = '2.4.2 · 死锁预防';

/** 静态图表：调用 steps 之外的构件，一次铺开 */
function still(host, title, badge) {
  return figure(host, { kicker: K, title, badge: badge || '一图看懂' });
}

/** 分步动画外壳 */
function anim(host, title, badge) {
  return figure(host, { kicker: K, title, badge: badge || '分步动画' });
}

/* ------------------------------------------------------------ 定义 */
function fDef(host) {
  const { stage, steps } = anim(host, '定义：把「必须同时成立」的条件拆掉一个');
  stage.append(frag(`
    <div class="qf-flow">
      <div class="qf-node qf-node--def" data-step="1">互斥<span class="qf-node__sub">资源只能给一个进程用</span></div>
      <div class="qf-node qf-node--def" data-step="1">不可剥夺<span class="qf-node__sub">拿到就不许被拿走</span></div>
      <div class="qf-node qf-node--def" data-step="1">请求并保持<span class="qf-node__sub">边占边等新资源</span></div>
      <div class="qf-node qf-node--def" data-step="1">循环等待<span class="qf-node__sub">首尾相接的等待环</span></div>
    </div>
    <div class="qf-banner qf-banner--warn" data-step="2">
      四个条件必须<b>同时成立</b>才可能死锁 —— 缺一个都不行。
    </div>
    <div class="qf-flow" data-step="3">
      <div class="qf-node qf-node--mute is-dead">循环等待<span class="qf-node__sub">被静态限制拆掉</span></div>
      <span class="qf-arw qf-arw--h" style="--c:var(--ok)"></span>
      <span class="qf-chip qf-chip--ok">环不存在 ⇒ 死锁无从产生</span>
    </div>
    <div class="qf-banner qf-banner--key" data-step="4">
      两个定语别丢：<b>分配之前</b>就施加约束、属于<b>静态</b>策略。运行中逐次判断安全状态的是<b>死锁避免</b>。
    </div>
  `));
  steps(
    [
      '① 死锁的四个必要条件：互斥、不可剥夺、请求并保持、循环等待。',
      '② 它们<b>同时成立</b>才会死锁，所以只要打破其中任意一个就够了。',
      '③ 图中把「循环等待」拆掉，等待环不成立，死锁自然无从产生。',
      '④ 记住定语：<b>分配之前、静态设限</b>；动态判断安全状态的是死锁避免。',
    ],
    { auto: 'view', hold: 2300 }
  );
}

/* ------------------------------------------------------------ 总体思路 */
function fMap(host) {
  const { stage } = still(host, '总览：一个必要条件对应一条预防途径');
  stage.append(frag(`
    <table class="qf-tbl">
      <thead><tr><th>必要条件</th><th>破坏手段</th><th>可行性</th></tr></thead>
      <tbody>
        <tr><td>互斥</td><td>改造成可共享（SPOOLing 虚拟设备）</td><td class="is-n">一般不采用</td></tr>
        <tr><td>不可剥夺</td><td>申请不到就释放已占，或强行剥夺</td><td>开销大</td></tr>
        <tr><td>请求并保持</td><td>一次性申请全部 / 逐步释放</td><td class="is-y">做法简单</td></tr>
        <tr><td>循环等待</td><td>资源按编号递增申请</td><td class="is-y">较实用</td></tr>
      </tbody>
    </table>
    <div class="qf-flow">
      <span class="qf-chip qf-chip--def">四条件缺一不可</span>
      <span class="qf-arw qf-arw--h"></span>
      <span class="qf-chip qf-chip--ok">破其一即可防死锁</span>
      <span class="qf-arw qf-arw--h"></span>
      <span class="qf-chip qf-chip--key">本节最重要的一句话</span>
    </div>
  `));
}

/* ------------------------------------------------------------ 1 破坏互斥 */
function fMutex(host) {
  const { stage } = still(host, '破坏互斥：让独占资源变成可共享', '判断图表');
  stage.append(frag(`
    <div class="qf-lanes">
      <div class="qf-lane">
        <div class="qf-lane__tag">独占资源</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--warn">打印机<span class="qf-node__sub">同一时刻只能服务一个进程</span></div>
          <div class="qf-node qf-node--warn">输入机</div>
          <div class="qf-node qf-node--warn">临界变量</div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">想改共享</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--mute">受<b>物理特性</b>限制</div>
          <span class="qf-arw qf-arw--h" style="--c:var(--sem-warn)"></span>
          <span class="qf-chip qf-chip--no">做不到</span>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">唯一例外</div>
        <div class="qf-lane__body">
          <span class="qf-chip qf-chip--ok">SPOOLing 假脱机</span>
          <div class="qf-node qf-node--ok">打印机 → 磁盘缓冲 → 逻辑共享<span class="qf-node__sub">输出先落盘，再由系统统一排队打印</span></div>
        </div>
      </div>
    </div>
    <div class="qf-banner qf-banner--warn">
      ① 很多资源的<b>物理特性</b>决定它只能互斥使用；② 为系统安全，许多资源<b>本就应当</b>互斥访问。
      因此这条路<b>不现实、一般不用</b> —— 问「哪种预防方法一般不采用」，答案就是破坏互斥。
    </div>
  `));
}

/* ------------------------------------------- 2 破坏不可剥夺 · 做法一 */
function fDepriveA(host) {
  const { stage, steps } = anim(host, '做法一 · 主动释放：要么全给，要么我全退');
  stage.append(frag(`
    <div class="qf-lanes">
      <div class="qf-lane">
        <div class="qf-lane__tag">P 已持有</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--ok" data-step="1" data-off="3">资源 A<span class="qf-node__sub">已占有</span></div>
          <div class="qf-node qf-node--ok" data-step="1" data-off="3">资源 B<span class="qf-node__sub">已占有</span></div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">新请求</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--warn" data-step="2">资源 C<span class="qf-node__sub">暂时给不出</span></div>
          <span class="qf-chip qf-chip--no" data-step="2">老规矩：攥着 A、B 死等 → 死锁</span>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">规则启动</div>
        <div class="qf-lane__body">
          <span class="qf-chip qf-chip--warn" data-step="3">P 释放已保持的全部资源（上排变灰）</span>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">之后</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--def" data-step="4">需要时重新申请 {A, B, C}<span class="qf-node__sub">凑齐再继续运行</span></div>
        </div>
      </div>
    </div>
    <div class="qf-banner qf-banner--key" data-step="5">
      禁止「<b>吃在碗里看着锅里</b>」：握着资源又去等新资源。已占的资源被<b>自己放回去</b> ⇒ 破坏 <b>不可剥夺条件</b>。
    </div>
  `));
  steps(
    [
      '① 进程 P 已经占住资源 A 和 B。',
      '② 接着申请 C，但系统<b>不能立即满足</b>。',
      '③ 旧规则下 P 会攥着 A、B 死等 C —— 这就是死锁的半成品。',
      '④ 预防规则：新请求不能立即满足时，P 必须<b>释放已保持的所有资源</b>，以后需要时重新申请。',
      '⑤ 判据：<b>自己把已占资源放回去</b> ⇒ 破坏的是<b>不可剥夺条件</b>。',
    ],
    { auto: 'view', hold: 2500 }
  );
}

/* ------------------------------------------- 2 破坏不可剥夺 · 做法二 */
function fDepriveB(host) {
  const { stage, steps } = anim(host, '做法二 · 被动剥夺：OS 从占用者手里抢过来');
  stage.append(frag(`
    <div class="qf-lanes">
      <div class="qf-lane">
        <div class="qf-lane__tag">P1</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--warn" data-step="1" data-off="4">占用打印机<span class="qf-node__sub">正在输出</span></div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">P2</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--def" data-step="2">请求打印机<span class="qf-node__sub">资源正被占用</span></div>
          <span class="qf-chip qf-chip--no" data-step="2">老规矩：等 P1 用完</span>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">OS 出手</div>
        <div class="qf-lane__body">
          <span class="qf-chip qf-chip--warn" data-step="3">强行剥夺 P1 手中的该资源</span>
          <span class="qf-arw qf-arw--h" style="--c:var(--sem-warn)" data-step="3"></span>
          <div class="qf-node qf-node--ok" data-step="3">转交请求进程 P2</div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">P1 的下场</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--mute" data-step="4">被阻塞 / 回退，等以后再申请</div>
        </div>
      </div>
    </div>
    <div class="qf-banner qf-banner--key" data-step="5">
      与做法一的差别：资源<b>不是自己放</b>，而是被<b>操作系统强制夺走</b>。同样推翻「一旦占有便不可夺」⇒ 破坏 <b>不可剥夺条件</b>。
    </div>
  `));
  steps(
    [
      '① 进程 P1 占着打印机正在输出。',
      '② 进程 P2 也申请打印机，但资源正被占用 —— 老规矩只能排队等。',
      '③ 预防手段：由<b>操作系统强行剥夺</b> P1 手中的资源，直接<b>转交</b>给 P2。',
      '④ P1 被阻塞或回退，等以后再申请。',
      '⑤ 主动释放 vs 被动剥夺：<b>前者自己退、后者被抢走</b>，破的都是<b>不可剥夺条件</b>。',
    ],
    { auto: 'view', hold: 2500 }
  );
}

/* ------------------------------------------- 2 破坏不可剥夺 · 易错点 */
function fDepriveTrap(host) {
  const { stage, steps } = anim(host, '易错点：剥夺的代价，以及它只能用在哪', '易错点动画');
  stage.append(frag(`
    <div class="qf-steps">
      <div class="qf-step" data-step="1">
        <div class="qf-step__idx">1</div>
        <div class="qf-step__body">剥夺发生 → 被剥夺进程<b>前一阶段的工作失效</b>（算了一半的中间结果作废）</div>
      </div>
      <div class="qf-step" data-step="2">
        <div class="qf-step__idx">2</div>
        <div class="qf-step__body">只能<b>重做</b> → 实现复杂、开销大、吞吐量下降，还可能引出新的等待</div>
      </div>
    </div>
    <div class="qf-grid qf-grid--2" data-step="3">
      <div class="qf-node qf-node--ok">CPU 寄存器 · 内存页面<span class="qf-node__sub">状态易保存、易恢复 ⇒ 可以剥夺</span></div>
      <div class="qf-node qf-node--warn">打印机 · 磁带机<span class="qf-node__sub">不可剥夺设备：打到一半收不回来</span></div>
    </div>
    <div class="qf-banner qf-banner--warn" data-step="4">
      结论句要背：<b>只适用于状态容易被保存和恢复的资源</b>；打印机这类<b>不可剥夺设备一般不适用</b>。
    </div>
  `));
  steps(
    [
      '① 抢走资源不是免费的：被剥夺进程已做的工作直接作废。',
      '② 作废就得重做 —— 实现复杂、开销大、吞吐量下降，甚至引发新的等待。',
      '③ 所以它有明确适用边界：<b>状态易保存恢复</b>的资源可用（CPU 寄存器、内存页面），<b>不可剥夺设备不行</b>（打印机）。',
      '④ 答题时把「只适用于状态易保存恢复的资源」写上去，就是满分点。',
    ],
    { auto: 'view', hold: 2400 }
  );
}

/* --------------------------------------- 3 破坏请求并保持 · 途径一 */
function fHoldA(host) {
  const { stage, steps } = anim(host, '途径一 · 资源预分配：运行前一次性申请全部');
  stage.append(frag(`
    <div class="qf-flow" data-step="1">
      <div class="qf-node qf-node--def">P 投入运行之前<span class="qf-node__sub">一次性申请所需全部资源 {A, B, C}</span></div>
    </div>
    <div class="qf-lanes" data-step="2">
      <div class="qf-lane">
        <div class="qf-lane__tag">凑得齐</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--ok">A、B、C 一次到手</div>
          <span class="qf-arw qf-arw--h" style="--c:var(--ok)"></span>
          <div class="qf-node qf-node--ok">才投入运行</div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">凑不齐</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--mute" data-step="3">一个都不占，空手等待<span class="qf-node__sub">不占有任何资源</span></div>
        </div>
      </div>
    </div>
    <div class="qf-banner qf-banner--ok" data-step="4">
      任何时刻都不会出现「<b>已占有资源 + 又阻塞等新资源</b>」⇒ 破坏 <b>请求并保持（占有并等待）条件</b>。
    </div>
  `));
  steps(
    [
      '① 规定：进程在<b>运行之前</b>一次性申请它需要的全部资源。',
      '② 资源全给到手，才允许它投入运行。',
      '③ 只要有一个资源不能满足，就<b>一个都不占</b>、空手等待。',
      '④ 于是「占有并等待」这个局面永远不出现 ⇒ 破坏 <b>请求并保持条件</b>。',
    ],
    { auto: 'view', hold: 2400 }
  );
}

/* --------------------------------------- 3 破坏请求并保持 · 途径二 */
function fHoldB(host) {
  const { stage, steps } = anim(host, '途径二 · 逐步释放：用完就还，再要新的');
  stage.append(frag(`
    <div class="qf-lanes">
      <div class="qf-lane">
        <div class="qf-lane__tag">启动</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--def" data-step="1">只申请运行初期所需的 A<span class="qf-node__sub">不必一次性要齐</span></div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">用完</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--ok" data-step="2" data-off="3">A 用毕 → 立即释放</div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">再申请</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--def" data-step="3">申请新资源 B<span class="qf-node__sub">手里没有「暂时不用」的资源</span></div>
        </div>
      </div>
    </div>
    <div class="qf-banner qf-banner--key" data-step="4">
      申请新资源的瞬间手中<b>不保留暂时不用的资源</b> ⇒ 请求并保持不成立 ⇒ 破坏 <b>请求并保持条件</b>。
    </div>
  `));
  steps(
    [
      '① 允许进程只拿到<b>运行初期所需</b>的资源就投入运行，不必一次要齐。',
      '② 运行中<b>用完就释放</b>（A 用毕立即归还）。',
      '③ 然后再申请新资源 —— 此时手里没有「暂时不用却占着」的资源。',
      '④ 同样是破坏 <b>请求并保持条件</b>，但比一次性申请灵活，利用率更高。',
    ],
    { auto: 'view', hold: 2400 }
  );
}

/* --------------------------------------- 3 破坏请求并保持 · 缺点 */
function fHoldCost(host) {
  const { stage } = still(host, '代价：资源躺着睡觉，进程饿着肚子', '因果图表');
  stage.append(frag(`
    <div class="qf-grid qf-grid--2">
      <div class="qf-node qf-node--warn">资源利用率低<span class="qf-node__sub">很晚才用到的资源也被提前占住 → 长期闲置浪费</span></div>
      <div class="qf-node qf-node--warn">可能发生饥饿<span class="qf-node__sub">始终凑不齐全部资源 → 迟迟不能运行，严重时永远得不到执行</span></div>
    </div>
    <div class="qf-flow">
      <span class="qf-chip qf-chip--warn">提前占住</span>
      <span class="qf-arw qf-arw--h" style="--c:var(--sem-warn)"></span>
      <span class="qf-chip qf-chip--warn">闲置浪费</span>
      <span class="qf-arw qf-arw--h" style="--c:var(--sem-warn)"></span>
      <span class="qf-chip qf-chip--no">吞吐量下降</span>
    </div>
    <div class="qf-banner qf-banner--warn">
      一句话：<b>做法简单，但代价是浪费与饥饿</b>。这也是「预防太保守、实际系统更愿意用避免或检测」的根源。
    </div>
  `));
}

/* ------------------------------------------------- 4 破坏循环等待 */
function fOrderWait(host) {
  const { stage, steps } = anim(host, '破坏循环等待：只能从小号往大号申请，环走不回来');
  stage.append(frag(`
    <div class="qf-steps" data-step="1">
      <div class="qf-step"><div class="qf-step__idx">1</div><div class="qf-step__body">给每类资源统一编号：打印机 = <b>1</b></div></div>
      <div class="qf-step"><div class="qf-step__idx">2</div><div class="qf-step__body">扫描仪 = <b>2</b>，磁带机 = <b>3</b>（同类资源一次性申请完）</div></div>
    </div>
    <div class="qf-lanes" data-step="2">
      <div class="qf-lane">
        <div class="qf-lane__tag">合法</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--ok">持 1 号 → 再要 2 号<span class="qf-node__sub">编号递增 ✔</span></div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">非法</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--warn">持 2 号 → 再要 1 号<span class="qf-node__sub">编号回落 ✘ 系统直接拒绝</span></div>
        </div>
      </div>
    </div>
    <div class="qf-flow" data-step="3">
      <div class="qf-node qf-node--def">P1 持 1 号等 2 号</div>
      <span class="qf-arw qf-arw--h"></span>
      <div class="qf-node qf-node--def">P2 持 2 号等 3 号</div>
      <span class="qf-chip qf-chip--ok">只能往上走 ⇒ 回不到起点 ⇒ 无环</span>
    </div>
    <div class="qf-banner qf-banner--warn" data-step="4">
      反过来若允许逆序：P1 持 1 号等 2 号、P2 持 2 号等 1 号 —— 两条等待边<b>首尾相接</b>，正是<b>环路</b>。
      强制递增后，所有等待边都指向更大编号，环路在结构上不可能出现。
    </div>
    <div class="qf-banner qf-banner--key" data-step="5">
      台阶比喻：踏上高编号台阶后就<b>永远回不到低编号</b> ⇒ 破坏 <b>循环等待条件</b>（不是请求并保持！）。
    </div>
  `));
  steps(
    [
      '① 给所有资源类型<b>统一编号</b>：打印机 1、扫描仪 2、磁带机 3。',
      '② 规定只能按<b>编号递增</b>顺序申请，同类资源一次性申请完。',
      '③ 合法请求一路往上走，多个进程的等待边排成一条单向链。',
      '④ 逆序申请会被直接拒绝，所以谁都不能「握大号回头等小号」，环路拼不起来。',
      '⑤ 破的是<b>循环等待条件</b>；最容易错答成请求并保持，务必记牢这一对。',
    ],
    { auto: 'view', hold: 2500 }
  );
}

/* ------------------------------------------------------- 总体评价 */
function fVerdict(host) {
  const { stage } = still(host, '总体评价：可靠但过严，真实系统常常绕开它', '对照图表');
  stage.append(frag(`
    <div class="qf-grid qf-grid--2">
      <div class="qf-node qf-node--ok">优点<span class="qf-node__sub">策略简单、可靠，从源头堵死死锁</span></div>
      <div class="qf-node qf-node--warn">缺点<span class="qf-node__sub">限制过严 → 资源利用率低、吞吐量下降、甚至饥饿</span></div>
    </div>
    <div class="qf-flow">
      <div class="qf-node qf-node--def">死锁预防<span class="qf-node__sub">静态 · 事前设限</span></div>
      <span class="qf-arw qf-arw--h"></span>
      <div class="qf-node qf-node--key">死锁避免<span class="qf-node__sub">动态 · 银行家算法</span></div>
      <span class="qf-arw qf-arw--h"></span>
      <div class="qf-node qf-node--exam">死锁检测与解除<span class="qf-node__sub">事后 · 查环再破环</span></div>
    </div>
    <div class="qf-banner qf-banner--key">
      答题口径：<b>预防可靠但太保守</b>，所以实际系统多转向更灵活的<b>避免</b>或<b>检测与解除</b>。
    </div>
  `));
}

/* --------------------------------------------------- 真题问法映射 */
function fExamMap(host) {
  const { stage } = still(host, '考点映射：四种问法对着四个答案', '考前速查');
  stage.append(frag(`
    <table class="qf-tbl">
      <thead><tr><th>问法</th><th>答案</th></tr></thead>
      <tbody>
        <tr><td>死锁预防的基本思想</td><td>破坏四个必要条件<b>之一或多个</b></td></tr>
        <tr><td>资源有序分配法破坏哪个条件</td><td class="is-y"><b>循环等待条件</b></td></tr>
        <tr><td>一次性申请全部资源破坏哪个条件</td><td class="is-y"><b>请求并保持条件</b></td></tr>
        <tr><td>哪种预防方法一般不采用</td><td>破坏<b>互斥条件</b></td></tr>
        <tr><td>哪种做法实现复杂、只适用可恢复资源</td><td>破坏<b>不可剥夺条件</b></td></tr>
      </tbody>
    </table>
    <div class="qf-banner qf-banner--warn">
      最爱互换的两对：<b>有序分配 ⇄ 循环等待</b>、<b>一次性申请 ⇄ 请求并保持</b>。
      看到「编号 / 顺序」就选循环等待，看到「运行前一次要齐」就选请求并保持。
    </div>
  `));
}

/* --------------------------------------- 大题提示（有序分配检查思路） */
function fCodeHint(host) {
  const { stage, steps } = anim(host, '解题思路：三步走，先翻译编号再比大小', '提示图解');
  stage.append(frag(`
    <div class="qf-steps">
      <div class="qf-step" data-step="1">
        <div class="qf-step__idx">1</div>
        <div class="qf-step__body">把 <code>rank</code> 列表翻译成「资源名 → 编号」字典<span class="qf-node__sub">下标 + 1 就是编号</span></div>
      </div>
      <div class="qf-step" data-step="2">
        <div class="qf-step__idx">2</div>
        <div class="qf-step__body">对每个进程，求它已持有资源的<b>最大编号</b>（没持有任何资源时视为 0）</div>
      </div>
      <div class="qf-step" data-step="3">
        <div class="qf-step__idx">3</div>
        <div class="qf-step__body">比较待申请资源的编号：<b>小于</b>最大编号 → 违规，记下该进程下标</div>
      </div>
    </div>
    <div class="qf-banner qf-banner--key" data-step="4">
      最后返回<b>升序</b>的下标列表；没有违规就返回空列表。
    </div>
  `));
  steps(
    [
      '① 先建编号表：<code>{名字: 编号}</code>，编号从 1 开始。',
      '② 每个进程的「已持最高编号」是判断基准，空手时为 0。',
      '③ 待申请编号 <b>严格小于</b>基准才算违规 —— 等于（同编号资源）是合法的。',
      '④ 收齐违规下标后<b>排序</b>再返回。',
    ],
    { auto: 'view', hold: 2600 }
  );
}

/* --------------------------------------- 大题解析（动画） */
function fCodeExplain(host) {
  const { stage, steps } = anim(host, '解析：三个边界最容易写错', '解析动画');
  stage.append(frag(`
    <div class="qf-lanes">
      <div class="qf-lane">
        <div class="qf-lane__tag">边界 1</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--ok" data-step="1">持 2 号，又要 2 号<span class="qf-node__sub">同编号 ⇒ 合法（不是严格递减）</span></div>
          <div class="qf-node qf-node--warn" data-step="2">持 2 号，又要 1 号<span class="qf-node__sub">编号回落 ⇒ 违规</span></div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">边界 2</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--ok" data-step="3">空手进程（held 为 []）<span class="qf-node__sub">基准取 0 ⇒ 任何申请都合法</span></div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">边界 3</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--def" data-step="4">返回值要<b>升序</b><span class="qf-node__sub">判题按列表逐项比对，顺序错了算错</span></div>
        </div>
      </div>
    </div>
    <div class="qf-banner qf-banner--key" data-step="5">
      记住语义：有序分配法检查的是「<b>不能回头申请更小编号</b>」，因此违规判据只有一个 —— 待申请编号 <b>&lt;</b> 已持最大编号。
    </div>
  `));
  steps(
    [
      '① 边界一：同编号资源是合法的，判据是严格小于，不要写成小于等于。',
      '② 持 2 号又要 1 号才是真正的违规（回头申请小号）。',
      '③ 边界二：什么都没持有的进程没有基准，取 0 即可，任何申请都合法。',
      '④ 边界三：返回列表要按进程下标<b>升序</b>，否则比对照样判错。',
      '⑤ 一句话总结：有序分配法只做一件事 —— 禁止「握大号、要小号」。',
    ],
    { auto: 'view', hold: 2600 }
  );
}

export const FIGS = {
  'pv-def': fDef,
  'pv-map': fMap,
  'pv-mutex': fMutex,
  'pv-nodep-a': fDepriveA,
  'pv-nodep-b': fDepriveB,
  'pv-nodep-trap': fDepriveTrap,
  'pv-hold-a': fHoldA,
  'pv-hold-b': fHoldB,
  'pv-hold-cost': fHoldCost,
  'pv-order': fOrderWait,
  'pv-verdict': fVerdict,
  'pv-exam': fExamMap,
  'pv-code-hint': fCodeHint,
  'pv-code-explain': fCodeExplain,
};
