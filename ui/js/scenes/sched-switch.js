/**
 * sched-switch.js —— 进程调度的时机、切换与过程、方式（2.2.2）
 *
 * 主舞台：A、B 两个进程与一台 CPU，中间横着一条「切换四步」流水线，
 * 一颗小球从 A 走到 B，走到哪一步哪一步就亮起来、字幕同步讲解。
 * 三个附加面板（互斥显示）：
 *   ① 不能调度的三种情形（红区）
 *   ② 模式切换 ≠ 进程切换
 *   ③ 抢占式 vs 非抢占式
 */
import {
  THREE,
  SceneHost,
  textSprite,
  retext,
  box,
  sphere,
  arrow,
  grid,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [1.0, 11.2, 18.6],
    target: [0, 1.6, 0],
    minDist: 13,
    maxDist: 46,
    maxPolarAngle: Math.PI * 0.47,
    label: '进程切换与调度时机',
  });
  const p = host.p;
  host.scene.add(grid(36));

  /* --------------------------------------------------------- 主舞台 */
  const proc = (x, t, c) => {
    const m = box(2.2, 1.4, 2.2, c, {
      opacity: 0.92, emissive: c, emissiveIntensity: 0.15, pos: [x, 1.0, 0],
    });
    host.scene.add(m);
    const lb = textSprite(t, { color: p.text1, height: 0.42 });
    lb.position.set(x, 2.0, 0);
    host.scene.add(lb);
    return m;
  };
  const PA = proc(-7.4, '进程 A', p.def);
  const PB = proc(7.4, '进程 B', p.accent);

  const cpu = box(2.6, 0.55, 2.6, p.key, {
    opacity: 0.94, emissive: p.key, emissiveIntensity: 0.22, pos: [0, 4.2, 0],
  });
  host.scene.add(cpu);
  const cpuLb = textSprite('CPU · 任一时刻只运行一个进程', { color: p.text1, height: 0.36 });
  cpuLb.position.set(0, 4.95, 0);
  host.scene.add(cpuLb);
  const cpuStem = arrow(new THREE.Vector3(0, 3.85, 0), new THREE.Vector3(0, 2.6, 0), p.key, {
    headR: 0.12, opacity: 0.5,
  });
  host.scene.add(cpuStem);

  /* ------------------------------------------------- 切换四步（A→B） */
  const STEPS = [
    ['① 保存现场', 'A 的 PC、通用寄存器、PSW 写入 A 的 PCB'],
    ['② 更新 PCB', 'A 状态改为「就绪 / 阻塞」，重新插入相应队列'],
    ['③ 选 B 并恢复', '调度程序挑中 B，从 B 的 PCB 恢复 PC 与寄存器'],
    ['④ 切换地址空间', '换页表基址、刷新 TLB —— 这一步开销最大'],
  ];
  const Z = -2.9;
  const nodes = [];
  STEPS.forEach((s, i) => {
    const x = -4.65 + i * 3.1;
    const b = box(2.5, 0.95, 1.7, p.surface3, {
      opacity: 0.85, emissive: p.memo, emissiveIntensity: 0.0, pos: [x, 1.0, Z],
    });
    host.scene.add(b);
    const lb = textSprite(s[0], { color: p.text1, height: 0.36 });
    lb.position.set(x, 1.75, Z);
    host.scene.add(lb);
    if (i > 0) {
      const a = arrow(
        new THREE.Vector3(x - 3.1 + 1.3, 1.0, Z),
        new THREE.Vector3(x - 1.3, 1.0, Z),
        p.line2,
        { headR: 0.1, opacity: 0.5 }
      );
      host.scene.add(a);
    }
    nodes.push(b);
  });
  const flowLb = textSprite('进程切换（Save → Update → Select → Restore）', {
    color: p.text3, height: 0.32,
  });
  flowLb.position.set(0, 0.18, Z);
  host.scene.add(flowLb);

  const token = sphere(0.24, p.accent, { emissive: p.accent, emissiveIntensity: 0.9 });
  host.scene.add(token);

  /* -------------------------------------------------- 附加面板组 */
  /* ① 三种不能调度的情形 */
  const gGuard = new THREE.Group();
  host.scene.add(gGuard);
  const GUARDS = [
    ['处理中断过程中', '中断响应未结束，不能切'],
    ['进程在内核临界区', '持有内核锁，切了会乱'],
    ['原子操作执行中', '关中断的 P/V 原语，不可分割'],
  ];
  GUARDS.forEach((g, i) => {
    const x = -5.2 + i * 5.2;
    const b = box(4.4, 1.2, 1.5, p.err, {
      opacity: 0.45, emissive: p.err, emissiveIntensity: 0.18, pos: [x, 1.0, 3.4],
    });
    gGuard.add(b);
    const l1 = textSprite(g[0], { color: p.text1, height: 0.36 });
    l1.position.set(x, 1.85, 3.4);
    gGuard.add(l1);
    const l2 = textSprite(g[1], { color: p.text3, height: 0.28 });
    l2.position.set(x, 0.42, 3.4);
    gGuard.add(l2);
  });
  const redLb = textSprite('这三种情况下「不能」调度（禁区）', { color: p.err, height: 0.38 });
  redLb.position.set(0, 2.55, 3.4);
  gGuard.add(redLb);

  /* ② 模式切换 ≠ 进程切换 */
  const gMode = new THREE.Group();
  host.scene.add(gMode);
  const uBox = box(3.4, 1.0, 1.6, p.def, { opacity: 0.85, pos: [-4.6, 1.0, 3.2] });
  const kBox = box(3.4, 1.0, 1.6, p.warn, { opacity: 0.85, pos: [0.2, 1.0, 3.2] });
  gMode.add(uBox, kBox);
  const uLb = textSprite('用户态', { color: p.text1, height: 0.36 });
  uLb.position.set(-4.6, 1.75, 3.2);
  const kLb = textSprite('内核态', { color: p.text1, height: 0.36 });
  kLb.position.set(0.2, 1.75, 3.2);
  gMode.add(uLb, kLb);
  const aMode = arrow(new THREE.Vector3(-2.7, 1.0, 3.2), new THREE.Vector3(-1.2, 1.0, 3.2), p.line2, {
    headR: 0.1, opacity: 0.8,
  });
  gMode.add(aMode);
  const modeLb = textSprite('模式切换（同一进程，只是进内核）', { color: p.text3, height: 0.28 });
  modeLb.position.set(-4.6, 0.35, 3.2);
  gMode.add(modeLb);
  const p2 = box(3.4, 1.0, 1.6, p.accent, { opacity: 0.85, pos: [4.6, 1.0, 3.2] });
  gMode.add(p2);
  const p2Lb = textSprite('进程 B 上下文', { color: p.text1, height: 0.36 });
  p2Lb.position.set(4.6, 1.75, 3.2);
  gMode.add(p2Lb);
  const aProc = arrow(new THREE.Vector3(2.1, 1.0, 3.2), new THREE.Vector3(3.0, 1.0, 3.2), p.accent, {
    headR: 0.12, opacity: 0.9,
  });
  gMode.add(aProc);
  const procLb = textSprite('进程切换：必须先进内核，且换地址空间', { color: p.accent, height: 0.28 });
  procLb.position.set(2.0, 0.35, 3.2);
  gMode.add(procLb);
  const keyLb = textSprite('进程切换一定伴随模式切换；模式切换不一定引起进程切换', {
    color: p.key, height: 0.34,
  });
  keyLb.position.set(0, 2.5, 3.2);
  gMode.add(keyLb);

  /* ③ 抢占 vs 非抢占 */
  const gPre = new THREE.Group();
  host.scene.add(gPre);
  const lane = (z, color, title, sub) => {
    const b = box(13.6, 0.34, 1.3, color, { opacity: 0.28, pos: [0, 1.0, z] });
    gPre.add(b);
    const l1 = textSprite(title, { color: color, height: 0.36 });
    l1.position.set(-5.6, 1.6, z);
    gPre.add(l1);
    const l2 = textSprite(sub, { color: p.text3, height: 0.28 });
    l2.position.set(1.4, 1.6, z);
    gPre.add(l2);
    return b;
  };
  lane(2.4, p.accent, '抢占式', '时间片到 / 更高优先级到达 → 立刻中断并切走');
  lane(4.4, p.def, '非抢占式', '进程主动放弃（结束、阻塞）才切换 → 简单但响应差');
  const preLb = textSprite('调度方式：谁来触发切换', { color: p.text2, height: 0.34 });
  preLb.position.set(-2.4, 3.3, 3.4);
  gPre.add(preLb);

  /* ------------------------------------------------------------ 交互 */
  const NOTES = {
    step: '切换四步：保存 A 现场 → 更新 A 的 PCB → 选 B 恢复现场 → 切换地址空间。第四步（换页表 + 刷 TLB）最贵。',
    guard: '三种不能调度：中断处理中、内核临界区中、原子操作中。判断依据是「此时切换会破坏内核的不变量」。',
    mode: '模式切换（用户态↔内核态）只是同一条线程换了权限级；进程切换必须换 PCB 与地址空间。前者常在，后者很贵。',
    preempt: '抢占式：时间片用完或高优先级进程到达就强行切走；非抢占式：必须等进程自己让出 CPU。',
  };

  let cur = 'step';
  const note = textSprite(NOTES.step, { color: p.text2, height: 0.32 });
  note.position.set(0, -0.85, 0);
  host.scene.add(note);

  const apply = (key) => {
    cur = key;
    token.visible = key === 'step';
    gGuard.visible = key === 'guard';
    gMode.visible = key === 'mode';
    gPre.visible = key === 'preempt';
    PA.material.opacity = key === 'step' ? 0.92 : 0.3;
    PB.material.opacity = key === 'step' ? 0.92 : 0.3;
    cpu.material.opacity = key === 'step' ? 0.94 : 0.3;
    nodes.forEach((n) => { n.material.opacity = key === 'step' ? 0.85 : 0.22; });
    retext(note, NOTES[key], { color: p.text2, height: 0.32 });
    host.cap(`<b>${
      key === 'step' ? '切换过程' : key === 'guard' ? '调度时机' : key === 'mode' ? '模式切换 vs 进程切换' : '调度方式'
    }</b> —— ${NOTES[key]}`);
  };

  const btns = host.toolbar([
    { label: '切换四步', active: true, onClick: () => { apply('step'); pick(btns[0]); } },
    { label: '何时不能调度', onClick: () => { apply('guard'); pick(btns[1]); } },
    { label: '模式切换 ≠ 进程切换', onClick: () => { apply('mode'); pick(btns[2]); } },
    { label: '抢占 / 非抢占', onClick: () => { apply('preempt'); pick(btns[3]); } },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  host.hint('注意「进程切换一定伴随模式切换，反之不成立」——这是简答题常考的一句话。');
  apply('step');

  /* ------------------------------------------------------------ 动画 */
  host.onTick((t) => {
    if (cur === 'step') {
      const u = ((t * 0.22) % 1 + 1) % 1;
      const x = -7.0 + u * 14.0;
      token.position.set(x, 1.0, Z);
      const idx = Math.min(3, Math.max(0, Math.floor((x + 4.65 + 1.55) / 3.1)));
      nodes.forEach((n, i) => {
        const near = i === idx;
        n.material.emissiveIntensity = near ? 0.55 + Math.sin(t * 6) * 0.15 : 0.0;
        n.material.opacity = near ? 1.0 : 0.7;
      });
    }
    cpu.material.emissiveIntensity = 0.22 + Math.sin(t * 2.6) * 0.1;
    if (cur === 'guard') {
      gGuard.children.forEach((c, i) => {
        if (c.material && c.material.emissiveIntensity !== undefined && c.geometry && c.geometry.type === 'BoxGeometry') {
          c.material.emissiveIntensity = 0.14 + Math.abs(Math.sin(t * 1.6 + i)) * 0.24;
        }
      });
    }
  });
}
