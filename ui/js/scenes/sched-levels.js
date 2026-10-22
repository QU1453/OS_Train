/**
 * sched-levels.js —— 调度的概念与层次（2.2.1）
 *
 * 一条从左到右的流水线：外存作业池 → 高级调度 → 内存就绪队列 → 低级调度 → CPU，
 * 外加一条向下的支路：就绪队列 ↔ 挂起队列（中级调度 / 对换）。
 * 三种调度的「频率」用小球往返速度直观区分：高级最慢、低级最快。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  retext,
  box,
  cylinder,
  sphere,
  arrow,
  grid,
  easeInOut,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [2.0, 10.4, 17.6],
    target: [0, 1.6, 0.8],
    minDist: 12,
    maxDist: 44,
    maxPolarAngle: Math.PI * 0.47,
    label: '三级调度流水线',
  });
  const p = host.p;
  host.scene.add(grid(36));

  /* ------------------------------------------------------- ① 外存作业池 */
  const disk = cylinder(2.1, 2.1, 0.34, p.line2, { seg: 40, pos: [-9.6, 0.5, 0] });
  host.scene.add(disk);
  const diskLb = textSprite('外存 · 作业池', { color: p.text2, height: 0.38 });
  diskLb.position.set(-9.6, 1.5, 0);
  host.scene.add(diskLb);

  const jobs = [];
  for (let i = 0; i < 4; i++) {
    const j = box(0.9, 0.62, 0.9, p.quote, {
      opacity: 0.9, emissive: p.quote, emissiveIntensity: 0.12,
      pos: [-6.9, 1.05 + i * 0.82, -0.9 + i * 0.6],
    });
    host.scene.add(j);
    jobs.push(j);
  }
  const jobLb = textSprite('后备队列（J1 J2 J3 …）', { color: p.text3, height: 0.3 });
  jobLb.position.set(-6.9, 4.55, 0.9);
  host.scene.add(jobLb);

  /* ------------------------------------------------------- ② 内存 + 就绪队列 */
  const memFloor = box(10.4, 0.16, 6.4, p.surface3, {
    opacity: 0.5, pos: [-1.2, 0.06, 0.6],
  });
  host.scene.add(memFloor);
  const memLb = textSprite('内存', { color: p.text3, height: 0.34 });
  memLb.position.set(-1.2, 0.06, 4.2);
  host.scene.add(memLb);

  const ready = [];
  for (let i = 0; i < 3; i++) {
    const s = box(1.15, 0.85, 1.15, p.def, {
      opacity: 0.9, emissive: p.def, emissiveIntensity: 0.14,
      pos: [-3.4 + i * 1.55, 0.95, 0.2],
    });
    host.scene.add(s);
    ready.push(s);
  }
  const readyLb = textSprite('就绪队列', { color: p.def, height: 0.36 });
  readyLb.position.set(-2.6, 2.0, 0.2);
  host.scene.add(readyLb);

  const runP = box(1.5, 1.15, 1.5, p.accent, {
    opacity: 0.95, emissive: p.accent, emissiveIntensity: 0.26,
    pos: [3.4, 1.15, 0.2],
  });
  host.scene.add(runP);
  const runLb = textSprite('运行', { color: p.accent, height: 0.36 });
  runLb.position.set(3.4, 2.3, 0.2);
  host.scene.add(runLb);

  /* ------------------------------------------------------- ③ CPU */
  const cpu = box(2.0, 1.9, 2.0, p.key, {
    opacity: 0.95, emissive: p.key, emissiveIntensity: 0.2,
    pos: [8.6, 1.35, 0.2],
  });
  host.scene.add(cpu);
  const cpuLb = textSprite('CPU', { color: p.text1, height: 0.44 });
  cpuLb.position.set(8.6, 2.75, 0.2);
  host.scene.add(cpuLb);

  /* ------------------------------------------------------- ④ 挂起队列 */
  const sus = [];
  for (let i = 0; i < 2; i++) {
    const s = box(1.1, 0.75, 1.1, p.warn, {
      opacity: 0.85, emissive: p.warn, emissiveIntensity: 0.12,
      pos: [-3.4 + i * 1.6, 0.9, 5.0],
    });
    host.scene.add(s);
    sus.push(s);
  }
  const susLb = textSprite('挂起队列（外存 · 已换出）', { color: p.warn, height: 0.34 });
  susLb.position.set(-2.5, 1.85, 5.0);
  host.scene.add(susLb);

  /* ------------------------------------------------------- ⑤ 三条通路 */
  const A_HI = arrow(new THREE.Vector3(-8.4, 1.7, 0), new THREE.Vector3(-5.6, 1.7, 0), p.quote, {
    headR: 0.14, opacity: 0.8,
  });
  host.scene.add(A_HI);
  const LB_HI = textSprite('高级调度（作业调度）', { color: p.quote, height: 0.34 });
  LB_HI.position.set(-7.0, 2.35, 0);
  host.scene.add(LB_HI);

  const A_LO = arrow(new THREE.Vector3(-1.5, 0.95, 0.2), new THREE.Vector3(6.8, 0.95, 0.2), p.accent, {
    headR: 0.15, opacity: 0.8,
  });
  host.scene.add(A_LO);
  const LB_LO = textSprite('低级调度（进程调度）', { color: p.accent, height: 0.34 });
  LB_LO.position.set(4.9, 0.5, 0.2);
  host.scene.add(LB_LO);

  const A_MID = arrow(new THREE.Vector3(-2.9, 0.9, 1.4), new THREE.Vector3(-2.9, 0.9, 4.0), p.warn, {
    headR: 0.13, opacity: 0.8,
  });
  const A_MID2 = arrow(new THREE.Vector3(-2.2, 0.9, 4.0), new THREE.Vector3(-2.2, 0.9, 1.4), p.warn, {
    headR: 0.13, opacity: 0.55,
  });
  host.scene.add(A_MID, A_MID2);
  const LB_MID = textSprite('中级调度（对换）', { color: p.warn, height: 0.32 });
  LB_MID.position.set(0.35, 1.0, 3.4);
  host.scene.add(LB_MID);

  /* ------------------------------------------------------- ⑥ 三颗小球 */
  const tHi = sphere(0.22, p.quote, { emissive: p.quote, emissiveIntensity: 0.9 });
  const tLo = sphere(0.2, p.accent, { emissive: p.accent, emissiveIntensity: 0.9 });
  const tMid = sphere(0.2, p.warn, { emissive: p.warn, emissiveIntensity: 0.9 });
  host.scene.add(tHi, tLo, tMid);

  /* ------------------------------------------------------- 交互 */
  const NOTES = {
    all: '三级调度：高级（外存→内存，低频）· 中级（内存↔外存，对换）· 低级（就绪→CPU，高频）。',
    hi: '高级调度（作业调度、长程调度）：从外存后备队列挑作业装入内存并建立进程。频率最低，分钟级。',
    mid: '中级调度（中程调度）：把暂不运行的进程换出到外存（挂起），需要时再换入（激活）。目的是提高内存利用率与系统吞吐量。',
    lo: '低级调度（进程调度、短程调度）：从就绪队列选一个进程上 CPU。频率最高，毫秒级，必须极致高效——它是整个 OS 里被调用最频繁的一段代码。',
  };

  let cur = 'all';
  const apply = (key) => {
    cur = key;
    const on = (k) => key === 'all' || key === k;
    tHi.visible = on('hi');
    tLo.visible = on('lo');
    tMid.visible = on('mid');
    A_HI.visible = LB_HI.visible = on('hi');
    A_LO.visible = LB_LO.visible = on('lo');
    A_MID.visible = A_MID2.visible = LB_MID.visible = on('mid');
    jobs.forEach((j) => { j.material.opacity = on('hi') ? 0.9 : 0.3; });
    sus.forEach((s) => { s.material.opacity = on('mid') ? 0.85 : 0.3; });
    ready.forEach((s) => { s.material.opacity = on('lo') ? 0.9 : 0.35; });
    cpu.material.opacity = on('lo') ? 0.95 : 0.35;
    retext(note, NOTES[key], { color: p.text2, height: 0.34 });
    host.cap(`<b>${key === 'all' ? '三级调度' : key === 'hi' ? '高级调度' : key === 'mid' ? '中级调度' : '低级调度'}</b> —— ${NOTES[key]}`);
  };

  const note = textSprite(NOTES.all, { color: p.text2, height: 0.34 });
  note.position.set(0, -0.85, 0.8);
  host.scene.add(note);

  const btns = host.toolbar([
    { label: '三级联动', active: true, onClick: () => { apply('all'); pick(btns[0]); } },
    { label: '高级调度', onClick: () => { apply('hi'); pick(btns[1]); } },
    { label: '中级调度（对换）', onClick: () => { apply('mid'); pick(btns[2]); } },
    { label: '低级调度', onClick: () => { apply('lo'); pick(btns[3]); } },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  host.hint('小球往返速度就是调度频率：高级最慢（分钟级），低级最快（毫秒级）。');
  apply('all');

  /* ------------------------------------------------------- 动画 */
  const seg = (t, a, b, c, dur) => {
    // 三段式：a→b→c，每段 dur 秒，末尾停留
    const total = dur * 2.6;
    const u = ((t % total) + total) % total;
    if (u < dur) return [a, b, easeInOut(u / dur)];
    if (u < dur * 2) return [b, c, easeInOut((u - dur) / dur)];
    return [c, c, 1];
  };
  const put = (m, pos) => m.position.set(pos[0], pos[1], pos[2]);

  host.onTick((t) => {
    if (tHi.visible) {
      const [a, b, u] = seg(t * 1.0, [-8.9, 1.7, 0], [-5.0, 1.7, 0], [-2.6, 1.05, 0.2], 0.85);
      put(tHi, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
    }
    if (tLo.visible) {
      const [a, b, u] = seg(t * 2.4, [-1.6, 0.98, 0.2], [2.0, 0.98, 0.2], [7.7, 1.0, 0.2], 0.6);
      put(tLo, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
    }
    if (tMid.visible) {
      const [a, b, u] = seg(t * 1.4, [-2.9, 0.95, 1.5], [-2.9, 0.95, 3.6], [-2.2, 0.95, 3.6], 0.9);
      put(tMid, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
    }
    cpu.material.emissiveIntensity = 0.2 + Math.sin(t * 3.4) * 0.12;
    runP.position.y = 1.15 + Math.sin(t * 2.2) * 0.06;
  });
}
