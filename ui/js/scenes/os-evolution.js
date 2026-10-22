/**
 * os-evolution.js —— 操作系统的发展历程（1.2）
 *
 * 演示：
 *   · 底部时间轴：手工操作 → 单道批处理 → 多道批处理 → 分时 → 实时；
 *   · 内存货架 + CPU 塔：作业球在「内存 ↔ CPU」之间往返；
 *   · 不同阶段同屏对比「内存里能装几道程序」与「CPU 利用率」。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  retext,
  box,
  cylinder,
  sphere,
  ring,
  grid,
} from './_runtime.js';

const SLOT_X = [-4.35, -1.45, 1.45, 4.35];
const CPU_POS = new THREE.Vector3(0, 1.05, -0.9);
const SLOT_Z = 2.9;

const STAGES = [
  {
    key: 'manual',
    name: '手工操作',
    year: '1946—1950s',
    jobs: 1,
    util: '≈ 0%',
    cap:
      '<b>手工操作阶段</b>：用户独占全机，装纸带、拨开关全靠人工。CPU 大部分时间在等操作员，利用率极低。',
    hint: '此阶段<b>没有操作系统</b>；主要矛盾是<b>人机速度不匹配</b>。',
  },
  {
    key: 'single',
    name: '单道批处理',
    year: '1950s 中期',
    jobs: 1,
    util: '低（≈30%）',
    cap:
      '<b>单道批处理</b>：内存中<b>只装一道</b>作业，由监督程序自动成批处理。解决人机矛盾，但 CPU 等 I/O 时仍空闲。',
    hint: '特征：<b>自动性、顺序性、单道性</b>。',
  },
  {
    key: 'multi',
    name: '多道批处理',
    year: '1960s 中期',
    jobs: 4,
    util: '高（≈80%）',
    cap:
      '<b>多道批处理</b>：内存中同时驻留多道程序，<b>交替占用 CPU</b>，I/O 与计算重叠。<b>操作系统正式诞生</b>。',
    hint: '特征：<b>多道、宏观并行、微观串行</b>；缺点是无交互、响应慢。',
  },
  {
    key: 'time',
    name: '分时系统',
    year: '1970s',
    jobs: 4,
    util: '较高（≈75%）',
    cap:
      '<b>分时系统</b>：把 CPU 时间切成<b>时间片</b>轮转分配给各终端，用户感觉「独占」一台机器。',
    hint: '特征：<b>同时性、交互性、独立性、及时性</b>。',
  },
  {
    key: 'realtime',
    name: '实时系统',
    year: '1970s 后',
    jobs: 3,
    util: '按需（重及时）',
    cap:
      '<b>实时系统</b>：必须在<b>严格截止时间</b>内响应。紧急任务优先级最高，可抢占其他任务。',
    hint: '特征：<b>及时性、可靠性</b>；分硬实时与软实时。',
  },
];

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [1.5, 12.5, 17.5],
    target: [0, 1.5, -0.2],
    minDist: 10,
    maxDist: 46,
    maxPolarAngle: Math.PI * 0.49,
    label: 'OS 发展历程',
  });
  const p = host.p;
  host.scene.add(grid(30));

  const COLORS = [p.memo, p.accent, p.def, p.accent2, p.exam];

  /* ------------------------------------------------------------ 时间轴 */
  const rail = box(15.4, 0.1, 0.16, p.line2, { edges: false });
  rail.position.set(0, 0.05, -5.4);
  host.scene.add(rail);

  const pillars = [];
  STAGES.forEach((s, i) => {
    const x = -7.0 + i * 3.5;
    const col = cylinder(0.24, 0.24, 1.0, COLORS[i], {
      emissive: COLORS[i],
      emissiveIntensity: 0.25,
      roughness: 0.45,
    });
    col.position.set(x, 0.5, -5.4);
    host.scene.add(col);

    const knob = sphere(0.24, COLORS[i], { emissive: COLORS[i], emissiveIntensity: 0.5 });
    knob.position.set(x, 1.06, -5.4);
    host.scene.add(knob);

    const nm = textSprite(s.name, { color: p.text1, height: 0.44 });
    nm.position.set(x, 2.25, -5.4);
    host.scene.add(nm);

    const yr = textSprite(s.year, { color: p.text3, height: 0.32 });
    yr.position.set(x, 1.72, -5.4);
    host.scene.add(yr);

    pillars.push({ col, knob, nm, yr, baseY: 0.5, on: false });
  });

  /* --------------------------------------------------------------- CPU */
  const cpuTower = cylinder(0.72, 0.82, 1.55, p.def, {
    emissive: p.def,
    emissiveIntensity: 0.18,
    roughness: 0.35,
  });
  cpuTower.position.set(CPU_POS.x, 0.78, CPU_POS.z);
  host.scene.add(cpuTower);

  const cpuRing = ring(0.86, 1.02, p.def, { opacity: 0.55 });
  cpuRing.rotation.x = -Math.PI / 2;
  cpuRing.position.set(CPU_POS.x, 1.62, CPU_POS.z);
  host.scene.add(cpuRing);

  const cpuLb = textSprite('CPU', { color: p.bg0, bg: p.def, height: 0.52 });
  cpuLb.position.set(CPU_POS.x, 1.62, CPU_POS.z);
  host.scene.add(cpuLb);

  const utilLb = textSprite('CPU 利用率', {
    color: p.text1,
    bg: 'rgba(255,255,255,0.92)',
    border: p.line2,
    height: 0.5,
  });
  utilLb.position.set(CPU_POS.x, 2.55, CPU_POS.z);
  host.scene.add(utilLb);

  /* --------------------------------------------------------- 内存货架 */
  const shelfLb = textSprite('内存（同时驻留的作业）', { color: p.text2, height: 0.4 });
  shelfLb.position.set(0, 0.12, SLOT_Z + 1.35);
  host.scene.add(shelfLb);

  const slots = [];
  const jobs = [];
  SLOT_X.forEach((x, i) => {
    const s = box(1.9, 1.0, 1.5, p.surface3, { opacity: 0.28, edges: true, edgeOpacity: 0.3 });
    s.position.set(x, 0.5, SLOT_Z);
    host.scene.add(s);
    slots.push(s);

    const col = [p.memo, p.accent, p.key, p.accent2][i];
    const jb = box(1.15, 0.56, 0.95, col, {
      emissive: col,
      emissiveIntensity: 0.28,
      roughness: 0.42,
    });
    jb.position.set(x, 0.42, SLOT_Z);
    host.scene.add(jb);

    const lb = textSprite('P' + (i + 1), { color: p.text2, height: 0.34 });
    lb.position.set(x, 0.98, SLOT_Z);
    host.scene.add(lb);

    jobs.push({ mesh: jb, label: lb, slot: new THREE.Vector3(x, 0.42, SLOT_Z) });
  });

  /* --------------------------------------------------------------- 状态 */
  let mode = 'multi';
  let visibleJobs = 4;
  let active = 0;
  let sub = 0;
  let subMode = 'cpu';
  let speed = 1;

  const setVisibleJobs = (n) => {
    jobs.forEach((j, i) => {
      const v = i < n;
      j.mesh.visible = v;
      j.label.visible = v;
      slots[i].visible = v;
    });
  };

  const nextActive = (cur) => {
    if (mode === 'realtime') return 0; // 实时：紧急任务反复抢占
    return (cur + 1) % Math.max(1, visibleJobs);
  };

  const apply = (idx) => {
    const s = STAGES[idx];
    mode = s.key;
    visibleJobs = s.jobs;
    speed = s.key === 'manual' ? 0.55 : 1;
    active = 0;
    sub = 0;
    subMode = 'cpu';
    setVisibleJobs(visibleJobs);
    pillars.forEach((m, i) => (m.on = i === idx));
    retext(utilLb, 'CPU 利用率 ' + s.util, {
      color: p.text1,
      bg: 'rgba(255,255,255,0.92)',
      border: p.line2,
      height: 0.5,
    });
    host.cap(s.cap);
    host.hint(s.hint);
  };

  const btns = host.toolbar(
    STAGES.map((s, i) => ({
      label: s.name,
      active: i === 2,
      onClick: (b) => {
        btns.forEach((x) => x.classList.toggle('is-active', x === b));
        apply(i);
      },
    }))
  );

  apply(2);

  /* ---------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    // 里程碑：选中项升起并呼吸
    pillars.forEach((m) => {
      const ty = m.baseY + (m.on ? 0.42 : 0);
      m.col.position.y += (ty - m.col.position.y) * Math.min(1, dt * 6);
      m.knob.position.y = m.col.position.y + 0.56;
      m.col.material.emissiveIntensity = m.on ? 0.75 + Math.sin(t * 4) * 0.2 : 0.2;
      m.knob.scale.setScalar(m.on ? 1.15 + Math.sin(t * 4) * 0.08 : 1);
      m.nm.material.opacity = m.on ? 1 : 0.62;
      m.yr.material.opacity = m.on ? 0.95 : 0.5;
    });

    // 调度推进
    if (mode !== 'manual') {
      sub += dt * speed;
      const dwell = mode === 'time' ? 0.95 : mode === 'realtime' ? 0.62 : 1.2;
      const rest = mode === 'time' ? 0.4 : mode === 'realtime' ? 0.26 : 0.5;
      const lim = subMode === 'cpu' ? dwell : rest;
      if (sub > lim) {
        sub = 0;
        if (subMode === 'cpu') {
          subMode = 'rest';
        } else {
          subMode = 'cpu';
          active = nextActive(active);
        }
      }
    }

    // 作业球移动
    jobs.forEach((j, i) => {
      if (!j.mesh.visible) return;
      const inCpu = mode !== 'manual' && i === active && subMode === 'cpu';
      const tgt = inCpu ? CPU_POS : j.slot;
      const bob = mode === 'manual' ? Math.sin(t * 7) * 0.05 : 0;
      j.mesh.position.lerp(tgt.clone().setY(tgt.y + bob), Math.min(1, dt * 5));
      const g = mode === 'manual' ? 0.12 : inCpu ? 1.1 : 0.28;
      j.mesh.material.emissiveIntensity += (g - j.mesh.material.emissiveIntensity) * Math.min(1, dt * 6);
      j.mesh.scale.setScalar(inCpu ? 1.06 : 1);
    });

    // CPU 顶环与利用率提示
    cpuRing.rotation.z = t * 0.9;
    cpuRing.material.opacity = 0.35 + Math.sin(t * 3) * 0.16;
    cpuTower.material.emissiveIntensity = 0.14 + Math.sin(t * 2.2) * 0.05;
    utilLb.position.y = 2.55 + Math.sin(t * 1.8) * 0.04;
  });
}
