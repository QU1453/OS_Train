/**
 * qfig/dl-242.js —— 2.4.2 死锁预防：题目解析图解
 */
import { figure, frag } from './_runtime.js';

const K = '题解 · 2.4.2 · 死锁预防';

function open(host, title, badge) {
  return figure(host, { kicker: K, title, badge: badge || '图表' });
}

/* ------------------------------------------------- q1 预防的基本思想 */
function fIdea(host) {
  const { stage } = open(host, '思想：事前施加限制，破坏必要条件之一或多条', '对照图表');
  stage.append(frag(`
    <table class="qf-tbl">
      <thead><tr><th>要被破坏的条件</th><th>具体做法</th><th>可行性</th></tr></thead>
      <tbody>
        <tr><td>互斥</td><td>把独占资源改造成可共享（SPOOLing）</td><td class="is-n">受物理特性限制，<b>一般不采用</b></td></tr>
        <tr><td>不可剥夺</td><td>申请不到就释放已占资源，或强行剥夺</td><td>开销大，仅适用于可恢复资源</td></tr>
        <tr><td>请求并保持</td><td>运行前一次性申请全部，或逐步释放</td><td>实现简单，但利用率低、可能饥饿</td></tr>
        <tr><td>循环等待</td><td>资源有序分配（按编号递增申请）</td><td class="is-y">较实用，但编程不便</td></tr>
      </tbody>
    </table>
    <div class="qf-flow">
      <span class="qf-chip qf-chip--ok">破坏条件 = 预防</span>
      <span class="qf-chip qf-chip--def">安全性判断 = 避免</span>
      <span class="qf-chip qf-chip--exam">事后查环 = 检测</span>
      <span class="qf-chip">不管它 = 鸵鸟</span>
    </div>
    <div class="qf-banner qf-banner--key">
      题干「破坏产生死锁的四个必要条件中的一个或多个」正是<b>死锁预防</b>的定义句 ⇒ <b>选 C</b>。
    </div>
  `));
}

/* --------------------------------- q2 资源有序分配 → 破坏循环等待（动画） */
function fOrder(host) {
  const { stage, steps } = open(host, '编号递增申请，让环路在数学上不可能出现', '分步动画');
  stage.append(frag(`
    <div class="qf-flow" data-step="1">
      <div class="qf-node qf-node--def">R1 · 打印机<span class="qf-node__sub">编号 1</span></div>
      <span class="qf-arw qf-arw--h"></span>
      <div class="qf-node qf-node--def">R2 · 扫描仪<span class="qf-node__sub">编号 2</span></div>
      <span class="qf-arw qf-arw--h"></span>
      <div class="qf-node qf-node--def">R3 · 绘图仪<span class="qf-node__sub">编号 3</span></div>
    </div>
    <div class="qf-lanes" data-step="2">
      <div class="qf-lane">
        <div class="qf-lane__tag">允许乱序</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--warn">P1 持 R2 → 要 R1<span class="qf-node__sub">逆序申请</span></div>
          <div class="qf-node qf-node--warn">P2 持 R1 → 要 R2<span class="qf-node__sub">逆序申请</span></div>
          <span class="qf-chip qf-chip--no">成环 → 死锁</span>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">强制递增</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--ok">持 R2 再要 R1<span class="qf-node__sub">编号 2 → 1，不是递增</span></div>
          <span class="qf-chip qf-chip--no">直接拒绝</span>
          <div class="qf-node qf-node--ok">持 R1 再要 R2<span class="qf-node__sub">编号 1 → 2，合法</span></div>
        </div>
      </div>
    </div>
    <div class="qf-banner qf-banner--ok" data-step="3">
      所有申请边都<b>指向更大编号</b>，等待关系只能单向往外走，<b>永远回不到起点</b> ⇒ 环路不可能形成 ⇒ 破坏 <b>循环等待条件</b>。
    </div>
    <div class="qf-banner qf-banner--warn" data-step="4">
      易错分界：<b>有序分配 → 循环等待</b>；<b>一次性申请全部 → 请求并保持</b>。这两个最爱互换出题。
    </div>
    <div class="qf-banner qf-banner--key" data-step="5">
      若进程在持有 R2 时又申请 R1，系统<b>直接拒绝并把已占资源退回</b>，进程不可能「握大号等小号」。
    </div>
  `));
  steps([
    '① 第一步：给每一类资源<b>统一编号</b>，例如打印机 = 1、扫描仪 = 2、绘图仪 = 3。',
    '② 若允许任意顺序：P1 持 2 号等 1 号，P2 持 1 号等 2 号 —— 这就是环路，死锁。',
    '③ 规定只能按<b>编号递增</b>申请：持 R2 再要 R1 属于逆序，直接判为非法请求。',
    '④ 于是所有等待边都从小号指向大号，只能越来越"大"，<b>无法绕回起点 ⇒ 环路不存在</b>，破坏的是<b>循环等待条件</b>。',
    '⑤ 牢记区分：<b>有序分配 = 破循环等待</b>；<b>一次性申请 = 破请求并保持</b>。本题选 <b>D</b>。',
  ], { hold: 2600 });
}

/* -------------------------------------- q3 一次性申请 → 破坏请求并保持 */
function fHold(host) {
  const { stage } = open(host, '两种时序对比：手里是否还攥着资源', '时序图表');
  stage.append(frag(`
    <div class="qf-lanes">
      <div class="qf-lane">
        <div class="qf-lane__tag">原来</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--warn">申请 A</div>
          <span class="qf-arw qf-arw--h"></span>
          <div class="qf-node qf-node--warn">拿到 A · 继续运行</div>
          <span class="qf-arw qf-arw--h"></span>
          <div class="qf-node qf-node--warn">申请 B<span class="qf-node__sub">此时仍持有 A</span></div>
          <span class="qf-chip qf-chip--no">请求并保持 ✔ 成立</span>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">预防后</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--ok">一次申请 {A, B}</div>
          <span class="qf-arw qf-arw--h" style="--c:var(--ok)"></span>
          <div class="qf-node qf-node--ok">全拿到 → 才开始运行</div>
          <div class="qf-node qf-node--mute">拿不全 → 一个都不占，空手等待</div>
        </div>
      </div>
    </div>
    <div class="qf-banner qf-banner--key">
      进程<b>再也不会「边占边等」</b>，请求并保持（占有并等待）条件被推翻 ⇒ 破坏 <b>请求并保持条件</b>，选 C。
    </div>
    <div class="qf-banner qf-banner--warn">
      副作用：资源闲置时间长、利用率低；若某进程需求特别大，还可能长期申请不到 → <b>饥饿</b>。
    </div>
  `));
}

/* ------------------------------------------ q4 破坏互斥 → 一般不采用 */
function fMutex(host) {
  const { stage } = open(host, '为什么「让资源可共享」这条路走不通', '判断图表');
  stage.append(frag(`
    <div class="qf-grid qf-grid--3">
      <div class="qf-node qf-node--warn">打印机<span class="qf-node__sub">同一时刻只能打一份</span></div>
      <div class="qf-node qf-node--warn">输入机<span class="qf-node__sub">物理上被一个进程占用</span></div>
      <div class="qf-node qf-node--warn">磁带机<span class="qf-node__sub">读写头只能定位一处</span></div>
    </div>
    <div class="qf-flow">
      <div class="qf-node qf-node--mute">想改成可共享</div>
      <span class="qf-arw qf-arw--h" style="--c:var(--sem-warn)"></span>
      <div class="qf-node qf-node--mute">受<b>物理特性</b>限制</div>
      <span class="qf-arw qf-arw--h" style="--c:var(--sem-warn)"></span>
      <span class="qf-chip qf-chip--no">做不到</span>
    </div>
    <div class="qf-banner qf-banner--warn">
      也只有少数设备能用 <b>SPOOLing（假脱机）</b>把独占改造成共享；而且很多资源<b>本就该互斥访问</b>才安全。所以破坏互斥<b>不现实、一般不采用</b> ⇒ <b>选 A</b>。
    </div>
  `));
}

/* -------------------------------------------------- q5 预防的代价 */
function fCost(host) {
  const { stage } = open(host, '预防可靠，但代价是性能与公平', '因果图表');
  stage.append(frag(`
    <table class="qf-tbl">
      <thead><tr><th>代价</th><th>为什么</th></tr></thead>
      <tbody>
        <tr><td>资源利用率低</td><td>一次性申请 → 资源被提前占住、长时间闲置</td></tr>
        <tr><td>系统吞吐量下降</td><td>限制过严，进程等待时间变长</td></tr>
        <tr><td>可能饥饿</td><td>需求大的进程长期凑不齐资源</td></tr>
        <tr><td>编程不便</td><td>有序分配要求按编号写申请顺序，破坏程序结构</td></tr>
      </tbody>
    </table>
    <div class="qf-banner qf-banner--warn">
      C 项称「能使系统在任何情况下都不发生死锁，且<b>几乎不影响性能</b>」—— 前半句虽对，但「几乎不影响性能」与<b>限制过严必然降低利用率</b>直接矛盾 ⇒ C 错误。
    </div>
  `));
}

/* --------------------------------- q6 释放全部 → 破坏不可剥夺（动画） */
function fDeprive(host) {
  const { stage, steps } = open(host, '申请不到就退回全部：让“占有”不再牢不可破', '分步动画');
  stage.append(frag(`
    <div class="qf-lanes">
      <div class="qf-lane">
        <div class="qf-lane__tag">P 已持有</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--ok" data-step="1" data-off="4">资源 A<span class="qf-node__sub">已占有</span></div>
          <div class="qf-node qf-node--ok" data-step="1" data-off="4">资源 B<span class="qf-node__sub">已占有</span></div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">P 又申请</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--warn" data-step="2">资源 C<span class="qf-node__sub">系统暂时给不出</span></div>
          <div class="qf-chip qf-chip--no" data-step="3">P 进入阻塞</div>
        </div>
      </div>
    </div>
    <div class="qf-banner qf-banner--warn" data-step="4">
      规则启动：<b>A、B 被全部收回/主动释放</b>（上排变灰）—— 「一旦占有便不可夺」被推翻。
    </div>
    <div class="qf-flow" data-step="5">
      <div class="qf-node qf-node--def">重新申请 {A, B, C}</div>
      <span class="qf-arw qf-arw--h"></span>
      <div class="qf-node qf-node--ok">凑齐就一次拿走<br><span class="qf-node__sub">凑不齐就继续空手等</span></div>
    </div>
    <div class="qf-banner qf-banner--key" data-step="6">
      破坏的是<b>不可剥夺条件</b> ⇒ 选 B。代价：实现复杂、开销大，只适用于状态易保存与恢复的资源。
    </div>
  `));
  steps([
    '① 进程 P 正常运行，已经占住了资源 A 和 B。',
    '② 接着 P 申请第三个资源 C，但系统<b>暂时拿不出</b>。',
    '③ 按老规矩 P 会一直阻塞：手里攥着 A、B，死等 C —— 这正是「请求并保持 + 不可剥夺」。',
    '④ 预防手段介入：<b>P 必须释放已持有的全部资源</b>（A、B 被收回），然后才能重新申请。',
    '⑤ 之后 P 只能把 {A, B, C} <b>一起重新申请</b>：要么全拿到，要么一个都不占。',
    '⑥ 于是「占有的资源不可被夺走」不再成立 ⇒ 破坏<b>不可剥夺条件</b>，本题选 <b>B</b>。',
  ], { hold: 2400 });
}

/* ------------------------------------------- q7 预防 vs 避免 */
function fPvsa(host) {
  const { stage } = open(host, '预防是静态设限，避免是动态判定', '对照图表');
  stage.append(frag(`
    <div class="qf-flow">
      <div class="qf-node qf-node--ok">死锁预防<span class="qf-node__sub">事前 · 静态限制</span></div>
      <span class="qf-arw qf-arw--h"></span>
      <div class="qf-node qf-node--def">死锁避免<span class="qf-node__sub">每次分配 · 动态判断</span></div>
      <span class="qf-arw qf-arw--h"></span>
      <div class="qf-node qf-node--exam">死锁检测<span class="qf-node__sub">事后 · 查环解除</span></div>
    </div>
    <table class="qf-tbl">
      <thead><tr><th>维度</th><th>死锁预防</th><th>死锁避免</th></tr></thead>
      <tbody>
        <tr><td>介入时机</td><td>分配<b>之前</b>就设好规矩</td><td><b>每次分配时</b>才判断</td></tr>
        <tr><td>判断依据</td><td>破坏四个必要条件</td><td>分配后系统是否仍<b>安全</b></td></tr>
        <tr><td>代表做法</td><td>有序分配、一次性申请</td><td><b>银行家算法</b></td></tr>
        <tr><td>灵活性</td><td class="is-n">保守，限制死</td><td class="is-y">更灵活，利用率更高</td></tr>
      </tbody>
    </table>
    <div class="qf-banner qf-banner--key">
      B 项表述完全对得上 ⇒ 选 B。A 把二者混为一谈；C 说反（避免更灵活）；D 张冠李戴（银行家算法属于避免）。
    </div>
  `));
}

export const FIGS = {
  'dl-pp-idea': fIdea,
  'dl-pp-order': fOrder,
  'dl-pp-hold': fHold,
  'dl-pp-mutex': fMutex,
  'dl-pp-cost': fCost,
  'dl-pp-deprive': fDeprive,
  'dl-pp-pvsa': fPvsa,
};
