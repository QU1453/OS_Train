/**
 * sched-algorithms.js —— 进程调度算法甘特图（2.2.4）
 *
 * 以立体甘特图对比 FCFS / SJF / HRRN / RR 四种非抢占（RR 为准抢占）算法的调度顺序。
 * 作业沿用本课例题：A(arr0, svc4)、B(arr1, svc3)、C(arr2, svc2)；RR 示例 q = 1。
 * 播放头随时间推进，逐步「点亮」已完成的执行片段。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  box,
  grid,
  clamp01,
} from './_runtime.js';

/* ------ 算法结果表（时间轴单位 = x 坐标轴，1 单位 = 1 个时间单位） ------ */
const X0 = -4.5;
const axisX = (t) => X0 + t;

const LANE = { A: 2.7, B: 0, C: -2.7 };

const PLANS = {
  fcfs: {
    name: '先来先服务 FCFS',
    seg: { A: [[0, 4]], B: [[4, 7]], C: [[7, 9]] },
    order: 'A → B → C',
    avgWait: 2.67,
    avgTurn: 5.67,
    cap: '<b>FCFS</b>：按到达先后排队，非抢占。长作业 A 先到，B、C 只能排队等待 → 对<b>短作业不利</b>（护航效应）。',
    hint: '选择依据：<b>到达先后</b>；<b>非抢占</b>；不会饥饿。',
  },
  sjf: {
    name: '短作业优先 SJF',
    seg: { A: [[0, 4]], C: [[4, 6]], B: [[6, 9]] },
    order: 'A → C → B',
    avgWait: 2.33,
    avgTurn: 5.33,
    cap: '<b>SJF</b>：每次在<i>已到达</i>的作业中挑<b>服务时间最短</b>者，非抢占。t=4 时 B(3)、C(2) 都在等，选更短的 C。',
    hint: '选择依据：<b>服务时间最短</b>；<b>非抢占</b>；长作业可能<b>饥饿</b>。',
  },
  hrrn: {
    name: '高响应比 HRRN',
    seg: { A: [[0, 4]], C: [[4, 6]], B: [[6, 9]] },
    order: 'A → C → B',
    avgWait: 2.33,
    avgTurn: 5.33,
    cap: '<b>HRRN</b>：t=4 时 R(B)=(3+3)/3=2.0，R(C)=(2+2)/2=2.0 并列 → 按规定取<b>服务时间短者</b> C。本例结果与 SJF 相同。',
    hint: '选择依据：<b>响应比 R=(等待+服务)/服务</b>；<b>非抢占</b>；长短兼顾，不饥饿。',
  },
  rr: {
    name: '时间片轮转 RR',
    seg: { A: [[0, 1], [3, 4], [6, 7], [8, 9]], B: [[1, 2], [4, 5], [7, 8]], C: [[2, 3], [5, 6]] },
    order: 'A→B→C→A→B→C→A→B→A',
    avgWait: 4.33,
    avgTurn: 7.33,
    cap: '<b>RR</b>（q=1）：按 FCFS 排队、每轮跑一个时间片，未完成回队尾。<b>抢占式</b>（时钟中断），响应公平，但长作业被反复推迟。',
    hint: '选择依据：<b>时间片到则回队尾</b>；<b>抢占</b>；公平、不饥饿，分时系统首选。',
  },
};

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0.8, 9.5, 16.5],
    target: [0, 1.2, 0],
    minDist: 11,
    maxDist: 42,
    maxPolarAngle: Math.PI * 0.49,
    label: 'SCHEDULING GANTT',
  });
  const p = host.p;
  const PC = { A: p.def, B: p.accent2, C: p.memo };
  host.scene.add(grid(24));

  /* --------------------------------------------------------- 坐标轴与刻度 */
  const zs = [4.3, -4.3];
  host.scene.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(axisX(0), 0, zs[0]), new THREE.Vector3(axisX(9), 0, zs[0])]),
      new THREE.LineBasicMaterial({ color: new THREE.Color(p.line2), transparent: true, opacity: 0.8 })
    )
  );
  for (let t = 0; t <= 9; t += 1) {
    const major = t % 3 === 0;
    const tick = box(0.05, 0.02, major ? 0.5 : 0.28, p.line2, { edges: false, opacity: 0.85 });
    tick.position.set(axisX(t), 0.02, zs[0] - (major ? 0.35 : 0.22));
    host.scene.add(tick);
    if (major) {
      const lb = textSprite(String(t), { color: p.text2, height: 0.4 });
      lb.position.set(axisX(t), -0.35, zs[0] - 0.7);
      host.scene.add(lb);
    }
  }

  /* ------------------------------------------------------------ 三条泳道 */
  Object.entries(LANE).forEach(([k, z]) => {
    const rail = box(9.4, 0.1, 1.5, p.surface3, { edges: false, emissive: PC[k], emissiveIntensity: 0.06, opacity: 0.5 });
    rail.position.set(0, 0.05, z);
    host.scene.add(rail);
    const lb = textSprite('进程 ' + k, { color: PC[k], bg: 'rgba(255,255,255,0.88)', border: PC[k], height: 0.58 });
    lb.position.set(axisX(0) - 1.1, 0.62, z);
    host.scene.add(lb);
  });

  /* ------------------------------------------------------------- 播放头 */
  const playhead = box(0.07, 1.55, 9.0, p.accent, { edges: false, emissive: p.accent, emissiveIntensity: 0.9, opacity: 0.75 });
  playhead.position.set(axisX(0), 0.78, 0);
  host.scene.add(playhead);
  const tLabel = textSprite('t = 0.0', { color: p.bg0, bg: p.accent, height: 0.48 });
  tLabel.position.set(axisX(0), 1.95, zs[0]);
  host.scene.add(tLabel);

  /* --------------------------------------------------------- 执行片段池 */
  let bars = [];
  const clearBars = () => {
    bars.forEach((b) => {
      b.mesh.parent && b.mesh.parent.remove(b.mesh);
      b.label.parent && b.label.parent.remove(b.label);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
    });
    bars = [];
  };

  const buildPlan = (key) => {
    clearBars();
    const plan = PLANS[key];
    Object.entries(plan.seg).forEach(([proc, list]) => {
      list.forEach(([s, e]) => {
        const w = Math.max(e - s, 0.16);
        const col = PC[proc];
        const m = box(w, 1.0, 1.34, col, {
          emissive: col,
          emissiveIntensity: 0.2,
          roughness: 0.45,
          edgeColor: col,
          edgeOpacity: 0.55,
        });
        m.position.set(axisX((s + e) / 2), 0.6, LANE[proc]);
        m.material.transparent = true;
        m.material.opacity = 0;
        m.visible = false;
        host.scene.add(m);
        const lab = textSprite(`${s}–${e}`, { color: p.bg0, bg: col, height: 0.42 });
        lab.position.set(axisX((s + e) / 2), 1.35, LANE[proc]);
        lab.visible = false;
        host.scene.add(lab);
        bars.push({ mesh: m, label: lab, start: s, end: e, shown: false, op: 0 });
      });
    });
  };

  /* -------------------------------------------------------------- 交互 */
  let playT = 0;
  let maxT = 9;
  let playing = false;
  let lastStep = -1;
  let plan = PLANS.fcfs;

  const select = (key, btn) => {
    plan = PLANS[key];
    buildPlan(key);
    playT = 0;
    lastStep = -1;
    playing = true;
    host.cap(plan.cap);
    host.hint(
      `${plan.hint}<br>执行顺序：<b>${plan.order}</b> &nbsp;|&nbsp; 平均等待 <b>${plan.avgWait}</b>，平均周转 <b>${plan.avgTurn}</b>`
    );
    btns.forEach((x) => x.classList.remove('is-active'));
    btn && btn.classList.add('is-active');
  };

  const btns = host.toolbar([
    { label: 'FCFS', active: true, onClick: (b) => select('fcfs', b) },
    { label: 'SJF', onClick: (b) => select('sjf', b) },
    { label: 'HRRN', onClick: (b) => select('hrrn', b) },
    { label: '时间片轮转 RR', onClick: (b) => select('rr', b) },
    { label: '重播', onClick: () => { playT = 0; playing = true; bars.forEach((x) => { x.shown = false; x.op = 0; x.mesh.material.opacity = 0; x.mesh.visible = false; x.label.visible = false; }); } },
  ]);

  select('fcfs', btns[0]);

  /* -------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    if (playing) {
      playT = Math.min(maxT, playT + dt * 1.75);
      if (playT >= maxT) playing = false;
    }
    const x = axisX(playT);
    playhead.position.x = x;
    tLabel.position.set(x, 1.95, zs[0]);
    // 读数每变化 0.1 才重建贴图，避免每帧创建纹理
    const step = Math.round(playT * 10);
    if (step !== lastStep) {
      lastStep = step;
      const next = textSprite('t = ' + playT.toFixed(1), { color: p.bg0, bg: p.accent, height: 0.48 });
      tLabel.material.map.dispose();
      tLabel.material.map = next.material.map;
      tLabel.material.needsUpdate = true;
    }

    bars.forEach((b) => {
      if (!b.shown && playT >= b.start - 0.02) {
        b.shown = true;
        b.mesh.visible = true;
        b.label.visible = true;
      }
      const target = b.shown ? 1 : 0;
      b.op += (target - b.op) * Math.min(1, dt * 6);
      b.mesh.material.opacity = b.op;
      b.label.material.opacity = b.op;
      const grow = 0.8 + 0.2 * clamp01(b.op);
      b.mesh.scale.x = grow;
      b.mesh.position.y = 0.6 + (1 - clamp01(b.op)) * 0.35;
    });

    tLabel.position.y = 1.95 + Math.sin(t * 2.2) * 0.03;
  });

  host.onDispose(() => clearBars());
}
