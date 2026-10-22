/**
 * sched-metrics.js —— 调度算法的评价指标（2.2.3）
 *
 * 用 FCFS 的三道进程画甘特图：P1(到0,服5) P2(到1,服3) P3(到2,服2)。
 * 每条泳道分「等待段（虚）+ 执行段（实）」，四种指标各用一种测量线：
 *   周转时间 = 完成 − 到达   |   带权周转 = 周转 ÷ 服务
 *   等待时间 = 周转 − 服务   |   响应时间 = 首次运行 − 到达
 */
import {
  THREE,
  SceneHost,
  textSprite,
  retext,
  box,
  ring,
  grid,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [1.0, 10.0, 15.6],
    target: [0, 1.5, 0],
    minDist: 11,
    maxDist: 40,
    maxPolarAngle: Math.PI * 0.46,
    label: '甘特图与四种评价指标',
  });
  const p = host.p;
  host.scene.add(grid(32));

  const X = (t) => -6.0 + t * 1.05;      // 时间轴 → 世界坐标
  const LANE_Z = [-2.4, 0, 2.4];
  const LANE_Y = 1.0;

  /* --------------------------------------------------- 数据（FCFS） */
  const PROCS = [
    { id: 'P1', arrive: 0, burst: 5, start: 0 },
    { id: 'P2', arrive: 1, burst: 3, start: 5 },
    { id: 'P3', arrive: 2, burst: 2, start: 8 },
  ];
  PROCS.forEach((q) => { q.finish = q.start + q.burst; });

  /* --------------------------------------------------- 时间标尺 */
  for (let t = 0; t <= 10; t += 2) {
    const lb = textSprite(String(t), { color: p.text3, height: 0.3 });
    lb.position.set(X(t), 0.16, -4.6);
    host.scene.add(lb);
    const tick = box(0.06, 0.3, 0.5, p.line2, { opacity: 0.5, pos: [X(t), 0.16, -4.1] });
    host.scene.add(tick);
  }
  const axisLb = textSprite('时间 t', { color: p.text3, height: 0.3 });
  axisLb.position.set(X(10.6), 0.16, -4.6);
  host.scene.add(axisLb);

  /* --------------------------------------------------- 三条泳道 */
  const waitBars = [];
  const runBars = [];
  const arriveMarks = [];
  const doneMarks = [];
  const nameLbs = [];

  PROCS.forEach((q, i) => {
    const z = LANE_Z[i];
    const base = box(12.4, 0.12, 1.5, p.surface3, { opacity: 0.35, pos: [-0.4, 0.42, z] });
    host.scene.add(base);

    const nl = textSprite(q.id, { color: p.text1, height: 0.44 });
    nl.position.set(-6.9, LANE_Y + 0.1, z);
    host.scene.add(nl);
    nameLbs.push(nl);

    // 等待段
    const wlen = Math.max(0.001, X(q.start) - X(q.arrive));
    const wb = box(wlen, 0.55, 1.0, p.warn, {
      opacity: 0.32, emissive: p.warn, emissiveIntensity: 0.1,
      pos: [X(q.arrive) + wlen / 2, LANE_Y, z],
    });
    host.scene.add(wb);
    waitBars.push(wb);

    // 执行段
    const rlen = X(q.finish) - X(q.start);
    const rb = box(rlen, 0.55, 1.0, p.def, {
      opacity: 0.95, emissive: p.def, emissiveIntensity: 0.16,
      pos: [X(q.start) + rlen / 2, LANE_Y, z],
    });
    host.scene.add(rb);
    runBars.push(rb);
    const rl = textSprite(`服务 ${q.burst}`, { color: p.text1, height: 0.28 });
    rl.position.set(X(q.start) + rlen / 2, LANE_Y + 0.42, z);
    host.scene.add(rl);

    // 到达标记
    const am = ring(0.22, 0.36, p.memo, { opacity: 0.9, seg: 28 });
    am.rotation.x = -Math.PI / 2;
    am.position.set(X(q.arrive), LANE_Y + 0.36, z);
    host.scene.add(am);
    arriveMarks.push(am);

    // 完成标记
    const dm = box(0.1, 1.3, 0.28, p.accent, {
      opacity: 0.9, emissive: p.accent, emissiveIntensity: 0.4,
      pos: [X(q.finish), LANE_Y + 0.35, z],
    });
    host.scene.add(dm);
    doneMarks.push(dm);
    const dl = textSprite('完成 ' + q.finish, { color: p.accent, height: 0.26 });
    dl.position.set(X(q.finish) + 0.62, LANE_Y + 0.95, z);
    host.scene.add(dl);
  });

  /* --------------------------------------------------- 四种测量线 */
  const mkMeasure = (q, z, from, to, color, y, text) => {
    const g = new THREE.Group();
    const len = Math.max(0.02, X(to) - X(from));
    const bar = box(len, 0.09, 0.16, color, {
      opacity: 0.95, emissive: color, emissiveIntensity: 0.4,
      pos: [X(from) + len / 2, y, z],
    });
    g.add(bar);
    const lb = textSprite(text, { color, height: 0.3 });
    lb.position.set(X(from) + len / 2, y + 0.38, z);
    g.add(lb);
    return g;
  };

  const gTurn = new THREE.Group();
  const gRatio = new THREE.Group();
  const gWait = new THREE.Group();
  const gResp = new THREE.Group();
  host.scene.add(gTurn, gRatio, gWait, gResp);

  PROCS.forEach((q, i) => {
    const z = LANE_Z[i];
    const turn = q.finish - q.arrive;
    const wait = q.start - q.arrive;
    const ratio = (turn / q.burst).toFixed(2);

    gTurn.add(mkMeasure(q, z, q.arrive, q.finish, p.accent, LANE_Y + 1.15, `周转 ${turn}`));
    gRatio.add(mkMeasure(q, z, q.arrive, q.finish, p.memo, LANE_Y + 1.15, `${turn} ÷ ${q.burst} = ${ratio}`));
    gWait.add(mkMeasure(q, z, q.arrive, q.start, p.warn, LANE_Y + 1.15, `等待 ${wait}`));
    gResp.add(mkMeasure(q, z, q.arrive, q.start, p.key, LANE_Y + 1.15, `响应 ${wait}`));
  });

  /* 总览：平均值的三块牌子 */
  const avg = [
    ['平均周转 6.67', `(5+7+8)/3`],
    ['平均带权 2.44', `(1.00+2.33+4.00)/3`],
    ['平均等待 3.33', `(0+4+6)/3`],
  ];
  const gAvg = new THREE.Group();
  host.scene.add(gAvg);
  avg.forEach((a, i) => {
    const x = -4.4 + i * 4.4;
    const b = box(3.9, 0.9, 1.4, p.key, {
      opacity: 0.28, emissive: p.key, emissiveIntensity: 0.1, pos: [x, 4.5, 0],
    });
    gAvg.add(b);
    const t1 = textSprite(a[0], { color: p.text1, height: 0.4 });
    t1.position.set(x, 4.9, 0);
    gAvg.add(t1);
    const t2 = textSprite(a[1], { color: p.text3, height: 0.3 });
    t2.position.set(x, 4.15, 0);
    gAvg.add(t2);
  });

  /* ------------------------------------------------------------ 交互 */
  const NOTES = {
    turn: '周转时间 = 完成时刻 − 到达时刻。本题 P1=5、P2=7、P3=8，平均 6.67。',
    ratio: '带权周转时间 = 周转时间 ÷ 服务时间，恒 ≥ 1。P1=1.00、P2≈2.33、P3=4.00，平均约 2.44。',
    wait: '等待时间 = 周转时间 − 服务时间（也等于在就绪队列里排队的时间之和）。本题 0、4、6，平均 3.33。',
    resp: '响应时间 = 首次获得 CPU 的时刻 − 到达时刻。对 FCFS 与等待时间相同，对分时系统才是关键指标。',
    avg: '三个平均值的口径要记牢；考试常要求「列出每道题的计算过程再求平均」。',
  };

  let cur = 'avg';
  const note = textSprite(NOTES.avg, { color: p.text2, height: 0.32 });
  note.position.set(0, -0.5, -1.2);
  host.scene.add(note);

  const apply = (key) => {
    cur = key;
    gTurn.visible = key === 'turn';
    gRatio.visible = key === 'ratio';
    gWait.visible = key === 'wait';
    gResp.visible = key === 'resp';
    gAvg.visible = key === 'avg';
    retext(note, NOTES[key], { color: p.text2, height: 0.32 });
    host.cap(`<b>${
      key === 'turn' ? '周转时间' : key === 'ratio' ? '带权周转时间' : key === 'wait' ? '等待时间' : key === 'resp' ? '响应时间' : '三个平均值'
    }</b> —— ${NOTES[key]}`);
  };

  const btns = host.toolbar([
    { label: '周转时间', onClick: () => { apply('turn'); pick(btns[0]); } },
    { label: '带权周转', onClick: () => { apply('ratio'); pick(btns[1]); } },
    { label: '等待时间', onClick: () => { apply('wait'); pick(btns[2]); } },
    { label: '响应时间', onClick: () => { apply('resp'); pick(btns[3]); } },
    { label: '平均值', active: true, onClick: () => { apply('avg'); pick(btns[4]); } },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  host.hint('甘特图按 FCFS 排：P1 独占 0~5，P2 排到 5~8，P3 排到 8~10。虚条是「等」，实条是「跑」。');
  apply('avg');

  /* ------------------------------------------------------------ 动画 */
  host.onTick((t) => {
    runBars.forEach((b, i) => {
      b.material.emissiveIntensity = 0.14 + Math.abs(Math.sin(t * 1.4 + i * 0.8)) * 0.18;
    });
    arriveMarks.forEach((m, i) => {
      m.material.opacity = 0.55 + Math.sin(t * 3 + i) * 0.35;
    });
    doneMarks.forEach((m, i) => {
      m.material.emissiveIntensity = 0.3 + Math.abs(Math.sin(t * 2.2 + i * 1.1)) * 0.35;
    });
    if (cur !== 'avg' && cur !== 'turn' && cur !== 'ratio' && cur !== 'wait' && cur !== 'resp') return;
    nameLbs.forEach((n, i) => { n.material.opacity = 1 - i * 0.02; });
  });
}
