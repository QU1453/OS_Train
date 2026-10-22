/**
 * proc-states.js —— 进程的五状态转换（2.1.2）
 *
 * 演示王道教材的五状态模型：创建 / 就绪 / 运行 / 阻塞 / 终止。
 * 点击下方按钮触发一个「事件」，CPU 令牌沿对应箭头在状态之间迁移；
 * 并给出三条「不可能」的转换，点击后给出红色警示。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  sphere,
  ring,
  arrow,
  line,
  grid,
  clamp01,
  easeInOut,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0.5, 12.5, 12.5],
    target: [0, 0.4, 0],
    minDist: 9,
    maxDist: 40,
    maxPolarAngle: Math.PI * 0.47,
    label: 'PROCESS STATE MODEL',
  });
  const p = host.p;
  host.scene.add(grid(26));

  /* --------------------------------------------------------- 五个状态节点 */
  const NODES = {
    new: { label: '创建态', sub: 'New', pos: new THREE.Vector3(-7.0, 0, 2.0), color: p.quote },
    ready: { label: '就绪态', sub: 'Ready', pos: new THREE.Vector3(-2.6, 0, -3.0), color: p.def },
    running: { label: '运行态', sub: 'Running', pos: new THREE.Vector3(2.8, 0, -3.0), color: p.memo },
    blocked: { label: '阻塞态', sub: 'Blocked', pos: new THREE.Vector3(-0.4, 0, 3.2), color: p.warn },
    exit: { label: '终止态', sub: 'Exit', pos: new THREE.Vector3(7.2, 0, 2.0), color: p.text3 },
  };

  const discs = {};
  Object.entries(NODES).forEach(([k, n]) => {
    const disc = ring(0, 1.35, n.color, { opacity: 0.16 });
    disc.rotation.x = -Math.PI / 2;
    disc.position.copy(n.pos).setY(0.03);
    host.scene.add(disc);
    const rim = ring(1.28, 1.45, n.color, { opacity: 0.6 });
    rim.rotation.x = -Math.PI / 2;
    rim.position.copy(n.pos).setY(0.04);
    host.scene.add(rim);
    discs[k] = { disc, rim, base: 0.16 };

    const l1 = textSprite(n.label, { color: n.color, bg: 'rgba(255,255,255,0.9)', border: n.color, height: 0.66 });
    l1.position.copy(n.pos).setY(1.9);
    host.scene.add(l1);
    const l2 = textSprite(n.sub, { color: p.text3, height: 0.4 });
    l2.position.copy(n.pos).setY(1.35);
    host.scene.add(l2);
  });

  /* ------------------------------------------------------------- 转换边 */
  const EDGES = [
    { from: 'new', to: 'ready', label: 'admit 许可', color: p.ok, off: 0 },
    { from: 'ready', to: 'running', label: 'dispatch 调度', color: p.memo, off: -0.62 },
    { from: 'running', to: 'ready', label: 'timeout 时间片到', color: p.accent, off: 0.62 },
    { from: 'running', to: 'blocked', label: 'wait 请求 I/O', color: p.warn, off: 0 },
    { from: 'blocked', to: 'ready', label: 'wakeup 事件完成', color: p.accent2, off: 0 },
    { from: 'running', to: 'exit', label: 'exit 结束', color: p.err, off: 0 },
  ];
  const Y = 0.3;
  EDGES.forEach((e) => {
    const a = NODES[e.from].pos.clone().setY(Y);
    const b = NODES[e.to].pos.clone().setY(Y);
    const dir = b.clone().sub(a).setY(0).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(e.off);
    a.add(perp);
    b.add(perp);
    host.scene.add(arrow(a, b, e.color, { headR: 0.14, opacity: 0.9 }));
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const lb = textSprite(e.label, { color: e.color, bg: 'rgba(255,255,255,0.86)', height: 0.5 });
    lb.position.copy(mid).setY(Y + 0.85);
    host.scene.add(lb);
  });

  // 一条「少见」的边：创建态 → 终止态（创建失败）
  host.scene.add(
    line(
      [NODES.new.pos.clone().setY(Y).add(new THREE.Vector3(0, 0, 1.5)), new THREE.Vector3(-7, Y, 6.4), new THREE.Vector3(7.2, Y, 6.4), NODES.exit.pos.clone().setY(Y).add(new THREE.Vector3(0, 0, 1.5))],
      p.text3,
      { dash: 0.24, gap: 0.18, opacity: 0.5 }
    )
  );
  const failLb = textSprite('创建失败（少见）', { color: p.text3, bg: 'rgba(255,255,255,0.86)', height: 0.44 });
  failLb.position.set(0, Y + 0.7, 6.4);
  host.scene.add(failLb);

  /* -------------------------------------------------------------- 令牌 */
  const token = sphere(0.42, p.accent2, { emissive: p.accent2, emissiveIntensity: 0.9 });
  token.position.copy(NODES.ready.pos).setY(0.5);
  host.scene.add(token);
  const halo = ring(0.6, 0.82, p.accent2, { opacity: 0.45 });
  halo.rotation.x = -Math.PI / 2;
  host.scene.add(halo);
  const tokenLabel = textSprite('PCB', { color: p.bg0, bg: p.accent2, height: 0.46 });
  host.scene.add(tokenLabel);

  /* --------------------------------------------------------- 动画状态机 */
  let cur = 'ready';
  let from = NODES.ready.pos.clone().setY(0.5);
  let to = from.clone();
  let prog = 1;
  let dur = 0.85;
  let ctrl = new THREE.Vector3();
  let flash = 0;
  const red = new THREE.Color(p.err);

  const moveTo = (key, seconds = 0.85) => {
    from = token.position.clone();
    to = NODES[key].pos.clone().setY(0.5);
    cur = key;
    prog = 0;
    dur = seconds;
    const mid = from.clone().add(to).multiplyScalar(0.5);
    ctrl = mid.setY(mid.y + 1.7 + from.distanceTo(to) * 0.14);
    Object.values(discs).forEach((d) => (d.base = 0.16));
  };

  /* -------------------------------------------------------------- 交互 */
  const btnDefs = [
    { label: 'admit 许可', act: () => { moveTo('ready'); setCap('创建完成，资源就绪 → <b>创建态 → 就绪态</b>（admit）。进程进入就绪队列，只差 CPU。'); }, from: 'new' },
    { label: 'dispatch 调度', act: () => { moveTo('running'); setCap('<b>就绪态 → 运行态</b>（dispatch）：被调度程序选中，分配 CPU，开始执行。'); }, from: 'ready' },
    { label: 'timeout 时间片到', act: () => { moveTo('ready'); setCap('<b>运行态 → 就绪态</b>（timeout）：时间片用完或被更高优先级进程抢占，退回就绪队列。'); }, from: 'running' },
    { label: 'wait 请求 I/O', act: () => { moveTo('blocked'); setCap('<b>运行态 → 阻塞态</b>（wait）：进程<i>主动</i>请求 I/O 或资源，暂停运行。这是唯一「主动」的转换。'); }, from: 'running' },
    { label: 'wakeup 事件完成', act: () => { moveTo('ready'); setCap('<b>阻塞态 → 就绪态</b>（wakeup）：等待的事件发生，被<i>其它进程或中断</i>唤醒，回到就绪队列。'); }, from: 'blocked' },
    { label: 'exit 结束', act: () => { moveTo('exit'); setCap('<b>运行态 → 终止态</b>（exit）：进程运行完毕或被撤销，等待系统回收资源、撤销 PCB。'); }, from: 'running' },
    { label: '阻塞→运行 ✗', act: () => { deny(); }, from: null },
    { label: '就绪→阻塞 ✗', act: () => { deny(); }, from: null },
  ];

  const setCap = (h) => host.cap(h);

  const deny = () => {
    flash = 1;
    host.cap('<b>这是一条「不可能」的转换！</b> 阻塞态事件完成后只能先回到就绪态；就绪态还没拿到 CPU，无法因请求事件而阻塞。');
    host.hint('<b>三条不可能</b>：阻塞→运行、就绪→阻塞、终止→任何态。');
  };

  const btns = host.toolbar(
    btnDefs.map((d) => ({
      label: d.label,
      onClick: (b) => {
        btns.forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        d.act();
      },
    }))
  );

  setCap('点击下方按钮触发一个<b>事件</b>，观察 PCB 令牌在五状态之间的迁移。');

  host.onTick((t, dt) => {
    if (prog < 1) {
      prog = clamp01(prog + dt / dur);
      const e = easeInOut(prog);
      const a = from.clone();
      const c = ctrl.clone();
      const b = to.clone();
      // 二次贝塞尔
      const q1 = a.clone().lerp(c, e);
      const q2 = c.clone().lerp(b, e);
      token.position.copy(q1.lerp(q2, e));
    } else {
      token.position.lerp(to, 1 - Math.pow(0.002, dt));
    }

    token.scale.setScalar(1 + Math.sin(t * 3.6) * 0.06);
    tokenLabel.position.set(token.position.x, token.position.y + 0.86, token.position.z);
    halo.position.set(token.position.x, 0.09, token.position.z);
    halo.rotation.z += dt * 0.9;
    halo.scale.setScalar(1 + Math.sin(t * 2.4) * 0.05);

    // 节点脉冲：当前所在 / 目标节点高亮
    Object.entries(discs).forEach(([k]) => {
      const d = discs[k];
      const on = k === cur;
      const targetOp = on ? 0.42 : 0.16;
      d.base += (targetOp - d.base) * Math.min(1, dt * 5);
      d.disc.material.opacity = d.base + Math.sin(t * 3) * (on ? 0.08 : 0.015);
    });

    // 不可能转换的红色闪烁
    if (flash > 0) {
      flash = clamp01(flash - dt * 1.6);
      const k = Math.abs(Math.sin(flash * Math.PI * 5));
      token.material.emissive.lerpColors(new THREE.Color(p.accent2), red, k);
    } else {
      token.material.emissive.lerp(new THREE.Color(p.accent2), Math.min(1, dt * 3));
    }
  });
}
