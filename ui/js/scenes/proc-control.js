/**
 * proc-control.js —— 进程控制（2.1.3）
 *
 * 五个状态摆成一张有向图，点「原语」按钮驱动一个小球在状态间迁移：
 *   创建 → 就绪 → 运行 → 阻塞 → 唤醒 → 就绪 … → 终止
 * 右侧的「关中断 … 开中断」框提示：原语必须原子执行。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  box,
  sphere,
  arrow,
  grid,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [3.0, 11.0, 15.5],
    target: [0.6, 0.5, 0.4],
    minDist: 11,
    maxDist: 44,
    maxPolarAngle: Math.PI * 0.48,
    label: '进程控制：五状态与原语',
  });
  const p = host.p;
  host.scene.add(grid(32));

  const ST = {
    new: { t: '创建', x: -6.2, z: -2.2, c: p.line2 },
    ready: { t: '就绪', x: -2.2, z: -2.2, c: p.def },
    run: { t: '运行', x: 2.0, z: -2.2, c: p.accent },
    block: { t: '阻塞', x: -2.2, z: 2.2, c: p.warn },
    exit: { t: '终止', x: 5.6, z: 2.2, c: p.quote },
  };

  const nodes = {};
  Object.entries(ST).forEach(([k, s]) => {
    const m = box(2.5, 0.34, 2.0, s.c, {
      opacity: 0.9,
      emissive: s.c,
      emissiveIntensity: 0.16,
      roughness: 0.5,
      pos: [s.x, 0.18, s.z],
    });
    host.scene.add(m);
    const lb = textSprite(s.t, { color: p.text1, height: 0.56 });
    lb.position.set(s.x, 0.72, s.z);
    host.scene.add(lb);
    nodes[k] = { m, lb, s, on: false };
  });

  /* ---------------------------------------------------------------- 迁移 */
  const EDGES = [
    ['new', 'ready', '创建原语 admit', 0],
    ['ready', 'run', '调度 dispatch', 0],
    ['run', 'ready', '时间片到 / 被抢占', 0],
    ['run', 'block', '请求 I/O 或 P 操作', 0],
    ['block', 'ready', 'I/O 完成 / V 操作唤醒', 0],
    ['run', 'exit', '正常结束', 0],
    ['block', 'exit', '异常终止', 0],
  ];

  const edges = EDGES.map(([a, b, label]) => {
    const A = ST[a];
    const B = ST[b];
    const mid = new THREE.Vector3((A.x + B.x) / 2, 0.18, (A.z + B.z) / 2);
    // 沿 A→B 方向两端各收进一点，避免箭头插进方块
    const dir = new THREE.Vector3(B.x - A.x, 0, B.z - A.z).normalize();
    const s = new THREE.Vector3(A.x, 0.18, A.z).addScaledVector(dir, 1.35);
    const e = new THREE.Vector3(B.x, 0.18, B.z).addScaledVector(dir, -1.35);
    const g = arrow(s, e, p.line2, { headR: 0.12, opacity: 0.6 });
    host.scene.add(g);
    const lb = textSprite(label, { color: p.text3, height: 0.3 });
    lb.position.set(mid.x, 0.55, mid.z);
    lb.visible = false;
    host.scene.add(lb);
    return { a, b, g, lb, label };
  });

  /* -------------------------------------------------------- 原语原子性 */
  const frame = box(0.16, 3.2, 4.4, p.memo, {
    opacity: 0.12,
    emissive: p.memo,
    roughness: 0.4,
    pos: [-9.6, 1.7, 0],
  });
  host.scene.add(frame);
  const atomLb = textSprite('原语：关中断 → 执行 → 开中断', { color: p.memo, height: 0.4 });
  atomLb.position.set(-9.6, 3.7, 0);
  host.scene.add(atomLb);
  const atomHint = textSprite('不可分割', { color: p.memo, height: 0.34 });
  atomHint.position.set(-9.6, 0.35, 0);
  host.scene.add(atomHint);

  /* ------------------------------------------------------------- 状态球 */
  const token = sphere(0.3, p.exam, { emissive: p.exam, emissiveIntensity: 0.9, seg: 24 });
  token.position.set(ST.new.x, 0.85, ST.new.z);
  host.scene.add(token);
  const tokenLb = textSprite('PCB', { color: p.exam, height: 0.34 });
  host.scene.add(tokenLb);

  let cur = 'new';
  const target = new THREE.Vector3(ST.new.x, 0.85, ST.new.z);

  const go = (to, msg) => {
    if (to === cur) return;
    cur = to;
    Object.keys(nodes).forEach((k) => (nodes[k].on = k === to));
    target.set(ST[to].x, 0.9, ST[to].z);
    host.cap(msg);
    host.hint(`当前状态：<b>${ST[to].t}</b>；PCB 被操作系统改写的字段随之更新。`);
  };

  const reset = () => {
    cur = 'new';
    Object.keys(nodes).forEach((k) => (nodes[k].on = k === 'new'));
    target.set(ST.new.x, 0.85, ST.new.z);
  };
  reset();

  /* --------------------------------------------------------------- 按钮 */
  const ACT = [
    {
      label: '创建',
      run: () =>
        go(
          'ready',
          '<b>创建原语</b>：分配 PCB → 分配内存 → 装入程序与数据 → 初始化 PCB（状态=就绪），插入<b>就绪队列</b>。',
        ),
    },
    {
      label: '调度（就绪→运行）',
      run: () =>
        go(
          'run',
          '<b>调度</b>：进程调度程序从就绪队列选一个，恢复其 PCB 现场（PC、寄存器），进程占用 CPU 开始执行。',
        ),
    },
    {
      label: '时间片到（运行→就绪）',
      run: () =>
        go(
          'ready',
          '<b>时间片用完或被更高优先级抢占</b>：保存现场到 PCB，状态改回<b>就绪</b>，重新排到就绪队列。',
        ),
    },
    {
      label: '阻塞（运行→阻塞）',
      run: () =>
        go(
          'block',
          '<b>阻塞原语 block</b>：进程主动请求 I/O 或 P 操作失败，保存现场、状态改<b>阻塞</b>，插入对应<b>等待队列</b>。<b>是进程自身的主动行为</b>。',
        ),
    },
    {
      label: '唤醒（阻塞→就绪）',
      run: () =>
        go(
          'ready',
          '<b>唤醒原语 wakeup</b>：I/O 完成或 V 操作成功，把进程从等待队列移入<b>就绪队列</b>。唤醒是<b>别的进程或中断处理程序</b>做的，<b>不是自己</b>。',
        ),
    },
    {
      label: '终止',
      run: () =>
        go(
          'exit',
          '<b>终止原语</b>：回收内存、关闭文件、撤销 PCB。注意：终止后该进程<b>不再存在</b>，PCB 被释放。',
        ),
    },
  ];

  const btns = host.toolbar(
    ACT.map((a, i) => ({ label: a.label, active: i === 0, onClick: (b) => (pick(b), a.run()) })),
  );
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  Object.keys(nodes).forEach((k) => (nodes[k].on = k === 'new'));

  /* ---------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    const k = Math.min(1, dt * 4.4);
    token.position.lerp(target, k);
    token.position.y = target.y + Math.sin(t * 3.4) * 0.07;
    tokenLb.position.set(token.position.x + 0.55, token.position.y + 0.05, token.position.z);

    Object.entries(nodes).forEach(([key, n]) => {
      const want = n.on ? 0.42 : 0.1;
      n.m.material.emissiveIntensity += (want - n.m.material.emissiveIntensity) * k;
      n.lb.material.opacity += ((n.on ? 1 : 0.55) - n.lb.material.opacity) * k;
    });

    // 当前状态相关的边高亮出来（把「能往哪走」显示清楚）
    edges.forEach((e, i) => {
      const live = e.a === cur || e.b === cur;
      const ln = e.g.children && e.g.children[0];
      if (ln && ln.material) ln.material.opacity = live ? 0.45 + Math.sin(t * 2.6 + i) * 0.3 : 0.12;
      e.lb.visible = live;
    });

    frame.material.opacity = 0.1 + Math.sin(t * 2) * 0.05;
    atomLb.material.opacity = 0.7 + Math.sin(t * 2.6) * 0.25;
    if (cur === 'exit') token.material.emissiveIntensity = 0.3;
    else token.material.emissiveIntensity = 0.8 + Math.sin(t * 4) * 0.25;
  });
}
