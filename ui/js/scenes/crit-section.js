/**
 * crit-section.js —— 同步与互斥的基本概念（2.3.1）
 *
 * 上下两条并发进程的「四段式」跑道：进入区 → 临界区 → 退出区 → 剩余区，
 * 中间夹着一台共享的临界资源（打印机）。
 *   互斥模式：A 在临界区时，B 被锁挡在门外（间接制约）
 *   同步模式：A 必须先完成，B 才能开始（直接制约）
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
  easeInOut,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [1.4, 9.6, 16.4],
    target: [0, 1.6, 0],
    minDist: 12,
    maxDist: 42,
    maxPolarAngle: Math.PI * 0.47,
    label: '临界区四段式与互斥',
  });
  const p = host.p;
  host.scene.add(grid(34));

  /* -------------------------------------------------------- 共享资源 */
  const res = box(2.0, 1.5, 2.0, p.warn, {
    opacity: 0.95, emissive: p.warn, emissiveIntensity: 0.18, pos: [-2.0, 2.5, 0],
  });
  host.scene.add(res);
  const resLb = textSprite('临界资源（打印机）', { color: p.text1, height: 0.4 });
  resLb.position.set(-2.0, 3.55, 0);
  host.scene.add(resLb);
  const resLb2 = textSprite('一次只允许一个进程使用', { color: p.text3, height: 0.28 });
  resLb2.position.set(-2.0, 1.55, 0);
  host.scene.add(resLb2);

  /* -------------------------------------------------------- 两条跑道 */
  const SEGS = [
    ['进入区', '检查并上锁', p.memo],
    ['临界区', '访问临界资源', p.def],
    ['退出区', '解锁', p.key],
    ['剩余区', '其余代码', p.surface3],
  ];
  const XS = [-7.0, -2.0, 3.0, 7.4];
  const laneZ = [-2.9, 2.9];
  const lanes = [];

  laneZ.forEach((z, li) => {
    const name = li === 0 ? '进程 A' : '进程 B';
    const c0 = li === 0 ? p.def : p.accent;
    const nl = textSprite(name, { color: c0, height: 0.42 });
    nl.position.set(-9.4, 1.1, z);
    host.scene.add(nl);

    const segs = [];
    SEGS.forEach((s, i) => {
      const w = i === 0 || i === 2 ? 2.4 : 2.2;
      const b = box(w, 0.42, 1.5, s[2], {
        opacity: 0.72, emissive: s[2], emissiveIntensity: 0.06,
        pos: [XS[i], 1.1, z],
      });
      host.scene.add(b);
      const lb = textSprite(s[0], { color: p.text1, height: 0.32 });
      lb.position.set(XS[i], 1.62, z);
      host.scene.add(lb);
      segs.push({ m: b, lb });
    });

    // 临界区与资源共享一条连线
    const link = arrow(
      new THREE.Vector3(XS[1], 1.4, z),
      new THREE.Vector3(-2.0, 1.95, z * 0.35),
      c0,
      { headR: 0.09, opacity: 0.4 }
    );
    host.scene.add(link);

    const tk = sphere(0.24, c0, { emissive: c0, emissiveIntensity: 0.9 });
    host.scene.add(tk);
    lanes.push({ name, z, c0, segs, tk, nl });
  });

  /* -------------------------------------------------------- 锁（门闸） */
  const lock = box(0.16, 1.5, 3.4, p.err, {
    opacity: 0.0, emissive: p.err, emissiveIntensity: 0.4, pos: [-4.6, 1.3, 0],
  });
  host.scene.add(lock);
  const lockLb = textSprite('锁 = 1（上锁）', { color: p.err, height: 0.3 });
  lockLb.position.set(-4.6, 2.35, 0);
  lockLb.material.opacity = 0;
  host.scene.add(lockLb);

  /* -------------------------------------------------------- 同步依赖 */
  const dep = arrow(new THREE.Vector3(7.6, 1.1, -2.9), new THREE.Vector3(-5.8, 1.1, 2.9), p.memo, {
    headR: 0.12, opacity: 0.0,
  });
  host.scene.add(dep);
  const depLb = textSprite('A 完成 → B 才能开始（直接制约）', { color: p.memo, height: 0.32 });
  depLb.position.set(1.2, 0.3, 0);
  depLb.material.opacity = 0;
  host.scene.add(depLb);

  /* -------------------------------------------------------- 四条准则 */
  const RULES = [
    ['空闲让进', '没人用就该放行'],
    ['忙则等待', '有人用就必须等'],
    ['有限等待', '不能饿死（要有上界）'],
    ['让权等待', '等的时候要交出 CPU'],
  ];
  const gRules = new THREE.Group();
  host.scene.add(gRules);
  RULES.forEach((r, i) => {
    const x = -6.6 + i * 4.4;
    const b = box(4.0, 0.85, 1.5, i < 3 ? p.ok : p.key, {
      opacity: 0.26, emissive: i < 3 ? p.ok : p.key, emissiveIntensity: 0.1,
      pos: [x, 5.0, 0],
    });
    gRules.add(b);
    const t1 = textSprite(r[0], { color: p.text1, height: 0.38 });
    t1.position.set(x, 5.42, 0);
    gRules.add(t1);
    const t2 = textSprite(r[1], { color: p.text3, height: 0.28 });
    t2.position.set(x, 4.66, 0);
    gRules.add(t2);
  });

  /* ------------------------------------------------------------ 交互 */
  const NOTES = {
    mutex: '互斥（间接制约）：A、B 争同一台打印机，进入区加锁、退出区解锁，临界区里只能有一个。',
    sync: '同步（直接制约）：A 先产生数据、B 才能消费，是「先后次序」而非「抢资源」，用信号量（初值 0）实现。',
    seg: '四段式必须能默写：进入区（检查+上锁）→ 临界区（访问临界资源）→ 退出区（解锁）→ 剩余区（其余代码）。',
    rule: '四条准则：空闲让进、忙则等待、有限等待、让权等待。「有限等待」防饿死，「让权等待」防忙等。',
  };

  let cur = 'mutex';
  const note = textSprite(NOTES.mutex, { color: p.text2, height: 0.32 });
  note.position.set(0, -1.0, 0);
  host.scene.add(note);

  const apply = (key) => {
    cur = key;
    gRules.visible = key === 'rule';
    lock.material.opacity = key === 'mutex' ? 0.22 : 0.0;
    lockLb.material.opacity = key === 'mutex' ? 1 : 0;
    dep.visible = key === 'sync';
    dep.material.opacity = key === 'sync' ? 0.75 : 0;
    depLb.visible = key === 'sync';
    depLb.material.opacity = key === 'sync' ? 1 : 0;
    lanes.forEach((L) => {
      L.tk.visible = key === 'mutex' || key === 'sync' || key === 'seg';
      L.segs.forEach((s, i) => {
        const hot = key === 'seg' && i === 1;
        s.m.material.opacity = key === 'seg' ? (hot ? 1 : 0.5) : 0.72;
        s.lb.material.opacity = key === 'seg' ? (hot ? 1 : 0.45) : 1;
      });
    });
    res.material.opacity = key === 'rule' ? 0.3 : 0.95;
    retext(note, NOTES[key], { color: p.text2, height: 0.32 });
    host.cap(`<b>${
      key === 'mutex' ? '互斥 · 间接制约' : key === 'sync' ? '同步 · 直接制约' : key === 'seg' ? '临界区四段式' : '四条准则'
    }</b> —— ${NOTES[key]}`);
  };

  const btns = host.toolbar([
    { label: '互斥（争资源）', active: true, onClick: () => { apply('mutex'); pick(btns[0]); } },
    { label: '同步（有先后）', onClick: () => { apply('sync'); pick(btns[1]); } },
    { label: '四段式', onClick: () => { apply('seg'); pick(btns[2]); } },
    { label: '四条准则', onClick: () => { apply('rule'); pick(btns[3]); } },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  host.hint('互斥是「抢」，同步是「等」；两者都用信号量实现，但初值不同（互斥 1，同步 0）。');
  apply('mutex');

  /* ------------------------------------------------------------ 动画 */
  const runLane = (L, t, cycle, hold) => {
    const u = ((t / cycle) % 1 + 1) % 1;
    // 0 → 进入区 → 临界区（停留 hold）→ 退出区 → 剩余区
    const pts = [XS[0] - 1.0, XS[0], XS[1], XS[2], XS[3], XS[3] + 1.0];
    const total = 4.0;
    const x = u * total;
    let pos;
    if (x < 1) pos = pts[0] + (pts[1] - pts[0]) * easeInOut(x);
    else if (x < 2) pos = pts[1] + (pts[2] - pts[1]) * easeInOut(x - 1);
    else if (x < 2 + hold) pos = pts[2];
    else if (x < 3 + hold) pos = pts[2] + (pts[3] - pts[2]) * easeInOut(x - 2 - hold);
    else if (x < 4 + hold) pos = pts[3] + (pts[4] - pts[3]) * easeInOut((x - 3 - hold) / (1 + hold));
    else pos = pts[5];
    L.tk.position.set(pos, 1.1, L.z);
    return { x: pos, inCrit: Math.abs(pos - XS[1]) < 0.35 && x >= 1.9 && x <= 2 + hold };
  };

  host.onTick((t) => {
    if (cur !== 'mutex' && cur !== 'sync' && cur !== 'seg') {
      res.material.emissiveIntensity = 0.18 + Math.sin(t * 1.6) * 0.06;
      return;
    }
    const A = lanes[0];
    const B = lanes[1];
    if (cur === 'sync') {
      // A 走完一轮，B 才开始
      const cA = runLane(A, t, 14, 0.25);
      const cB = runLane(B, t + 7, 14, 0.25);
      A.tk.material.color.set(cA.inCrit ? p.ok : A.c0);
      B.tk.material.color.set(cB.inCrit ? p.ok : B.c0);
    } else {
      const cA = runLane(A, t, 10, 0.8);
      const cB = runLane(B, t + 5, 10, 0.8);
      // 谁在临界区，另一个就必须在门外等
      const busy = cA.inCrit || cB.inCrit;
      if (cA.inCrit && B.tk.position.x > XS[1] - 2.6) {
        B.tk.position.x = XS[1] - 2.6;
        B.tk.material.color.set(p.warn);
      } else if (!cA.inCrit) {
        B.tk.material.color.set(B.c0);
      }
      if (cB.inCrit && A.tk.position.x > XS[1] - 2.6) {
        A.tk.position.x = XS[1] - 2.6;
        A.tk.material.color.set(p.warn);
      } else if (!cB.inCrit) {
        A.tk.material.color.set(A.c0);
      }
      res.material.emissiveIntensity = busy ? 0.55 : 0.18;
      lock.material.opacity = busy ? 0.3 + Math.sin(t * 8) * 0.1 : 0.0;
    }
  });
}
