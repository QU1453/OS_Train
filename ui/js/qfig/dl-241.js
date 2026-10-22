/**
 * qfig/dl-241.js —— 2.4.1 死锁概念：题目解析图解
 * 每个 fig 名对应一道题（quiz.json 里的 "fig" 字段）。
 */
import { figure, frag } from './_runtime.js';

const K = '题解 · 2.4.1 · 死锁概念';

function open(host, title, badge) {
  return figure(host, { kicker: K, title, badge: badge || '图表' });
}

/* ---------------------------------------------------------------- q1 定义 */
function fDef(host) {
  const { stage, steps } = open(host, 'P1、P2 各持一个资源，又都要对方手里的', '分步动画');
  stage.append(frag(`
    <div class="qf-lanes">
      <div class="qf-lane">
        <div class="qf-lane__tag">P1</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--def" data-step="1">P1<span class="qf-node__sub">进程</span></div>
          <span class="qf-arw qf-arw--h" data-step="1"></span>
          <div class="qf-node qf-node--ok" data-step="1">R1 · 打印机<span class="qf-node__sub">已占有 · 不释放</span></div>
          <span class="qf-arw qf-arw--h" data-step="2"></span>
          <div class="qf-node qf-node--warn" data-step="2">请求 R2<span class="qf-node__sub">R2 在 P2 手里 → 阻塞</span></div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">P2</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--def" data-step="1">P2<span class="qf-node__sub">进程</span></div>
          <span class="qf-arw qf-arw--h" data-step="1"></span>
          <div class="qf-node qf-node--ok" data-step="1">R2 · 扫描仪<span class="qf-node__sub">已占有 · 不释放</span></div>
          <span class="qf-arw qf-arw--h" data-step="2"></span>
          <div class="qf-node qf-node--warn" data-step="2">请求 R1<span class="qf-node__sub">R1 在 P1 手里 → 阻塞</span></div>
        </div>
      </div>
    </div>
    <div class="qf-banner qf-banner--warn" data-step="3">
      两条链首尾相接 ⇒ <b>循环等待</b>：没有任何一方能推进，也没有任何一方会退出，<b>僵局</b>形成。
    </div>
    <div class="qf-banner qf-banner--key" data-step="4">
      参与死锁的进程数 <b>≥ 2</b>。单个进程不可能与自己形成死锁 ⇒ 选项 <b>D 错误</b>。
    </div>
  `));
  steps([
    '① <b>先各自持有</b>：P1 拿到打印机 R1，P2 拿到扫描仪 R2 —— 占有后<b>不可剥夺</b>。',
    '② <b>再互相伸手</b>：P1 要 R2、P2 要 R1，目标都<b>握在对方手里</b>，于是双双阻塞。',
    '③ 谁都不释放、谁都不退出，等待关系首尾相接 ⇒ <b>循环等待</b>，这就是死锁。',
    '④ 死锁<b>至少涉及两个进程</b>，单进程不会与自身死锁 —— 所以 D 项错，本题选 <b>D</b>。',
  ], { hold: 2500 });
}

/* ------------------------------------------------------ q2 四个必要条件 */
function fCond(host) {
  const { stage, steps } = open(host, '四个必要条件 + 口诀「互不请循」', '分步动画');
  stage.append(frag(`
    <div class="qf-grid qf-grid--2">
      <div class="qf-node qf-node--def" data-step="1">互斥条件<span class="qf-node__sub">资源一段时间内只能给一个进程用</span></div>
      <div class="qf-node qf-node--def" data-step="2">请求并保持条件<span class="qf-node__sub">已持有资源 → 又申请新资源，且不释放旧的</span></div>
      <div class="qf-node qf-node--def" data-step="3">不可剥夺条件<span class="qf-node__sub">已获得的资源不能被强行夺走，只能自己释放</span></div>
      <div class="qf-node qf-node--def" data-step="4">循环等待条件<span class="qf-node__sub">存在一条进程—资源的环形等待链</span></div>
    </div>
    <div class="qf-flow" data-step="5">
      <span class="qf-chip qf-chip--key">互</span>
      <span class="qf-chip qf-chip--key">不</span>
      <span class="qf-chip qf-chip--key">请</span>
      <span class="qf-chip qf-chip--key">循</span>
      <span class="qf-node__sub">＝ 互斥 · 不可剥夺 · 请求并保持 · 循环等待</span>
    </div>
    <div class="qf-banner qf-banner--warn" data-step="6">
      A 项把「<b>不</b>可剥夺」写成「<b>可</b>剥夺」—— 一字之差就错；C、D 混进的「并发」「共享」是操作系统的<b>特征</b>，不是死锁的<b>条件</b>。
    </div>
  `));
  steps([
    '① 第一个条件：<b>互斥</b> —— 资源同一时刻只服务一个进程。',
    '② 第二个条件：<b>请求并保持</b>（也叫占有并等待）—— 手里攥着旧的，嘴上还要新的。',
    '③ 第三个条件：<b>不可剥夺</b> —— 已经给的资源收不回来，只能等它自己放。',
    '④ 第四个条件：<b>循环等待</b> —— 等待关系绕成了一个环。',
    '⑤ 记口诀：<b>互 · 不 · 请 · 循</b>（互斥、不可剥夺、请求并保持、循环等待）。',
    '⑥ 对照选项：A 把「不可剥夺」改成「可剥夺」⇒ 错；C、D 塞进了并发/共享 ⇒ 错。余下 <b>B</b> 四项全对 ⇒ <b>选 B</b>。',
  ], { hold: 2300 });
}

/* ------------------------------------------------------- q3 死锁 vs 饥饿 */
function fHunger(host) {
  const { stage } = open(host, '死锁 ≠ 饥饿：四个维度分开看', '对照图表');
  stage.append(frag(`
    <table class="qf-tbl">
      <thead><tr><th>对比项</th><th>死 锁</th><th>饥 饿</th></tr></thead>
      <tbody>
        <tr><td>涉及进程</td><td>必然 <b>≥ 2</b> 个，互相等待</td><td>可以只有 <b>1</b> 个</td></tr>
        <tr><td>进程状态</td><td class="is-n">都是阻塞态，不占 CPU</td><td>长期等不到资源</td></tr>
        <tr><td>能否自行解除</td><td class="is-n">不能，必须有外力打破</td><td class="is-y">策略改变后<b>可能自行解除</b></td></tr>
        <tr><td>本质</td><td>循环等待形成的僵局</td><td>分配策略不公平</td></tr>
      </tbody>
    </table>
    <div class="qf-banner qf-banner--warn">
      D 项说「二者本质相同、都一定需要 OS 干预」——前半句否认区别，后半句否认饥饿可能自行解除，<b>两处都错</b>。本题选 D。
    </div>
  `));
  // 静态图表：无分步
}

/* ------------------------------------------------- q4 资源足够 → 不会死锁 */
function fEnough(host) {
  const { stage } = open(host, '资源“都够用”时，请求永远不必等待', '结构图表');
  stage.append(frag(`
    <div class="qf-flow">
      <div class="qf-node qf-node--def">进程提出请求<span class="qf-node__sub">每类资源总量 ≥ 所有进程最大需求之和</span></div>
      <span class="qf-arw qf-arw--h" style="--c:var(--ok)"></span>
      <div class="qf-node qf-node--ok">立刻满足<span class="qf-node__sub">不需要等待任何人释放</span></div>
      <span class="qf-arw qf-arw--h" style="--c:var(--ok)"></span>
      <div class="qf-node qf-node--ok">继续推进<span class="qf-node__sub">不存在等待边 ⇒ 不可能成环</span></div>
    </div>
    <table class="qf-tbl">
      <thead><tr><th>选项</th><th>情形</th><th>能否死锁</th></tr></thead>
      <tbody>
        <tr><td>A</td><td>各持一个再互相索要</td><td class="is-n">可能 — 典型环路</td></tr>
        <tr><td>B</td><td>每类资源都够所有进程的最大需求</td><td class="is-y">不会 — 请求必被满足</td></tr>
        <tr><td>C</td><td>边申请边释放，但请求顺序不一致</td><td class="is-n">可能 — 顺序不一致正是成环的温床</td></tr>
        <tr><td>D</td><td>多进程持多个不可剥夺资源并继续申请</td><td class="is-n">可能 — 请求并保持 + 不可剥夺</td></tr>
      </tbody>
    </table>
    <div class="qf-banner qf-banner--ok">
      关键判断句：<b>“请求必被满足”</b> ⇒ 不会有进程因等资源而阻塞 ⇒ 死锁无从谈起。<b>选 B</b>。
    </div>
  `));
}

/* --------------------------------------------------- q5 死循环 vs 死锁 */
function fLoop(host) {
  const { stage } = open(host, '死循环在跑，死锁在等 —— CPU 是否被烧是分水岭', '对照图表');
  stage.append(frag(`
    <div class="qf-grid qf-grid--2">
      <div class="qf-node qf-node--warn">死 循 环<span class="qf-node__sub">程序逻辑错误：循环条件永远为真</span></div>
      <div class="qf-node qf-node--exam">死 锁<span class="qf-node__sub">资源竞争：多进程互相等待</span></div>
    </div>
    <table class="qf-tbl">
      <thead><tr><th>对比项</th><th>死循环</th><th>死锁</th></tr></thead>
      <tbody>
        <tr><td>进程状态</td><td class="is-n">仍在 <b>运行态</b></td><td class="is-y">全部 <b>阻塞态</b></td></tr>
        <tr><td>是否占 CPU</td><td class="is-n">占，白白烧 CPU</td><td class="is-y">不占，只是干等</td></tr>
        <tr><td>涉及进程数</td><td>单个即可</td><td>必然 ≥ 2 个</td></tr>
        <tr><td>成因</td><td>程序自身逻辑错</td><td>资源分配与推进顺序不当</td></tr>
        <tr><td>如何解决</td><td>改程序 / 强制终止进程</td><td>剥夺资源、撤销进程</td></tr>
      </tbody>
    </table>
    <div class="qf-banner qf-banner--key">
      一句话判据：<b>死循环 = 一直在跑；死锁 = 一个都跑不了。</b> 故 C 正确。
    </div>
  `));
}

/* --------------------------------------------- q6 必要条件 ≠ 充分条件 */
function fNecess(host) {
  const { stage, steps } = open(host, '有环路 ≠ 一定死锁：多实例资源会打断环', '分步动画');
  stage.append(frag(`
    <div class="qf-banner qf-banner--def" data-step="1">
      「必要条件」的含义是：<b>只要发生了死锁，四个条件一定同时成立</b>；反向不一定成立。
    </div>
    <div class="qf-lanes" data-step="2">
      <div class="qf-lane">
        <div class="qf-lane__tag">P1</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--ok">持有 R1（2 台中的 1 台）</div>
          <span class="qf-arw qf-arw--h" style="--c:var(--sem-warn)"></span>
          <div class="qf-node qf-node--warn">请求 R2<span class="qf-node__sub">R2 只在 P2 手里 → 等</span></div>
        </div>
      </div>
      <div class="qf-lane">
        <div class="qf-lane__tag">P2</div>
        <div class="qf-lane__body">
          <div class="qf-node qf-node--ok">持有 R2</div>
          <span class="qf-arw qf-arw--h" style="--c:var(--sem-warn)"></span>
          <div class="qf-node qf-node--warn">请求 R1<span class="qf-node__sub">R1 还剩 1 台空闲 → 等什么？</span></div>
        </div>
      </div>
    </div>
    <div class="qf-banner qf-banner--ok" data-step="3">
      R1 还有一台<b>空闲实例</b>：P2 的请求立刻被满足 ⇒ 环路被打断，P2 跑完释放 R2 ⇒ P1 也解开。<b>有环路却没死锁</b>。
    </div>
    <div class="qf-banner qf-banner--key" data-step="4">
      结论：四条件是<b>必要</b>条件，不是充分条件，也不是充分必要条件。满足它只说明「<b>有可能</b>发生死锁」⇒ 选 <b>C</b>。
    </div>
  `));
  steps([
    '① 先弄清「必要条件」的方向：死锁 ⇒ 四条件成立；不是四条件成立 ⇒ 死锁。',
    '② 看一个真的出现<b>环路</b>的例子：P1 持 R1 要 R2，P2 持 R2 要 R1。',
    '③ 但 R1 有<b>两个实例</b>，还有一台空闲 —— P2 的请求被满足，环被打断，谁都没死锁。',
    '④ 所以满足四条件只是「埋下了可能」，未必真死锁 ⇒ 选 <b>C</b>：可能发生，但不一定。',
  ], { hold: 2600 });
}

/* --------------------------------------------------- q7 四种处理策略 */
function fStrat(host) {
  const { stage } = open(host, '四种策略：谁在事前、谁在事中、谁在事后', '定位图表');
  stage.append(frag(`
    <table class="qf-tbl">
      <thead><tr><th>策略</th><th>介入时机</th><th>核心手段</th><th>代表做法</th></tr></thead>
      <tbody>
        <tr><td class="is-y">死锁预防</td><td>事前（静态）</td><td><b>破坏四个必要条件之一</b></td><td>有序分配、一次性申请</td></tr>
        <tr><td>死锁避免</td><td>分配时（动态）</td><td>判断分配后是否仍安全</td><td>银行家算法</td></tr>
        <tr><td>死锁检测</td><td>事后</td><td>找出环路再解除</td><td>资源分配图化简</td></tr>
        <tr><td>鸵鸟策略</td><td>不介入</td><td>假装不会发生</td><td>PC 上的 Windows / Linux</td></tr>
      </tbody>
    </table>
    <div class="qf-flow">
      <span class="qf-chip qf-chip--ok">破坏之一 = 预防</span>
      <span class="qf-chip qf-chip--def">安全判定 = 避免</span>
      <span class="qf-chip qf-chip--exam">查环路 = 检测</span>
      <span class="qf-chip">不处理 = 鸵鸟</span>
    </div>
    <div class="qf-banner qf-banner--key">
      题干「<b>破坏四个必要条件之一</b>」是死锁预防的定义句 ⇒ <b>选 A</b>。
    </div>
  `));
}

/* ------------------------------------- q8 死锁的成因（PDF 第 4 章 Q7） */
function fCause(host) {
  const { stage } = open(host, '死锁的两类成因：不只“抢资源”这一条', '因果图表');
  stage.append(frag(`
    <div class="qf-grid qf-grid--2">
      <div class="qf-node qf-node--warn">成因一 · 资源竞争<span class="qf-node__sub">资源不足、不可剥夺 · 多个进程抢同类资源</span></div>
      <div class="qf-node qf-node--def">成因二 · 推进顺序不当<span class="qf-node__sub">资源够用，但请求与释放的时序刚好咬合</span></div>
    </div>
    <div class="qf-flow">
      <div class="qf-node qf-node--mute">两类成因任一成立</div>
      <span class="qf-arw qf-arw--h"></span>
      <div class="qf-node qf-node--mute">都可能造成死锁</div>
      <span class="qf-arw qf-arw--h"></span>
      <div class="qf-node qf-node--exam">但都不是「必然」</div>
    </div>
    <div class="qf-banner qf-banner--warn">
      「死锁一定是由于竞争资源引起的」——错。资源充足时，<b>推进顺序不当</b>同样会死锁，所以这条因果不是唯一的，也不是必然的。
    </div>
  `));
}

export const FIGS = {
  'dl-def': fDef,
  'dl-cond': fCond,
  'dl-hunger': fHunger,
  'dl-enough': fEnough,
  'dl-loop': fLoop,
  'dl-necess': fNecess,
  'dl-strat': fStrat,
  'dl-cause': fCause,
};
