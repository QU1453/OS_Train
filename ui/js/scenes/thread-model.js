/**
 * thread-model.js —— 线程的概念与多线程模型（2.1.5）
 *
 * 三列并排对比三种线程模型，每列自下而上是「硬件 → 内核 → 用户空间 → 应用」：
 *   ① 用户级线程 ULT：线程库在用户态切换，内核只看见 1 个线程（1 条通道）
 *   ② 内核级线程 KLT：1:1，每个线程都是一次真正的内核调度（3 条通道）
 *   ③ 多对多 M:N：3 个用户线程复用 2 个内核线程（2 条通道）
 * 小球代表线程的「执行权」，沿通道上下穿梭；通道数就是内核感知到的线程数。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  retext,
  box,
  sphere,
  ring,
  grid,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [1.2, 11.6, 19.0],
    target: [0, 2.3, 0],
    minDist: 14,
    maxDist: 48,
    maxPolarAngle: Math.PI * 0.47,
    label: '三种多线程模型',
  });
  const p = host.p;
  host.scene.add(grid(36));

  const Y0 = 0.58;   // 硬件 / CPU
  const Y1 = 1.78;   // 内核
  const Y2 = 2.98;   // 用户空间（线程库 / 用户线程）
  const Y3 = 4.10;   // 应用（三个线程）

  const COLORS = [p.def, p.accent, p.memo];

  /* ------------------------------------------------------------ 一列 */
  const COLS = [
    {
      key: 'ult', x: -5.5, title: '① 用户级线程 ULT',
      kernel: '内核：只看到 1 个线程',
      user: '线程库（用户态）调度 3 个线程',
      lanes: 1, users: 3,
      note: '切换不进内核 → 极快；但一个线程阻塞，整个进程都阻塞',
    },
    {
      key: 'klt', x: 0, title: '② 内核级线程 KLT（1:1）',
      kernel: '内核：登记 3 个线程',
      user: '每个用户线程对应一个内核线程',
      lanes: 3, users: 3,
      note: '可多核并行；线程切换要进内核，开销大',
    },
    {
      key: 'mn', x: 5.5, title: '③ 多对多 M:N',
      kernel: '内核：只登记 2 个线程',
      user: '3 个用户线程复用到 2 个内核线程',
      lanes: 2, users: 3,
      note: '兼得轻量与并行；实现最复杂（调度器要激活）',
    },
  ];

  const plate = (x, y, w, d, color, text, h = 0.38) => {
    const m = box(w, 0.3, d, color, {
      opacity: 0.9,
      emissive: color,
      emissiveIntensity: 0.1,
      roughness: 0.5,
      pos: [x, y, 0],
    });
    host.scene.add(m);
    const lb = textSprite(text, { color: p.text1, height: h });
    lb.position.set(x, y + 0.32, d / 2 + 0.03);
    host.scene.add(lb);
    return { m, lb };
  };

  COLS.forEach((c) => {
    const g = new THREE.Group();
    host.scene.add(g);

    c.hw = plate(c.x, Y0, 4.4, 3.0, p.line2, 'CPU 硬件');
    c.ke = plate(c.x, Y1, 4.4, 2.7, p.warn, c.kernel, 0.34);
    c.us = plate(c.x, Y2, 4.4, 2.4, p.key, c.user, 0.32);

    // 三个用户线程（顶层的三个小方块）
    c.th = [];
    for (let i = 0; i < 3; i++) {
      const tx = c.x + (i - 1) * 1.24;
      const tb = box(1.0, 0.7, 1.0, COLORS[i], {
        opacity: 0.95,
        emissive: COLORS[i],
        emissiveIntensity: 0.2,
        roughness: 0.42,
        pos: [tx, Y3, 0],
      });
      host.scene.add(tb);
      const tl = textSprite('T' + (i + 1), { color: p.text1, height: 0.34 });
      tl.position.set(tx, Y3 + 0.62, 0);
      host.scene.add(tl);
      c.th.push({ m: tb, lb: tl, x: tx });
    }

    // 通道小球：几条通道 = 内核看得见几个线程
    c.tokens = [];
    for (let i = 0; i < c.lanes; i++) {
      const ox = c.x + (c.lanes === 1 ? 0 : (i - (c.lanes - 1) / 2) * 1.3);
      for (let k = 0; k < 2; k++) {
        const s = sphere(0.17, COLORS[i % 3], { emissive: COLORS[i % 3], emissiveIntensity: 0.8 });
        host.scene.add(s);
        c.tokens.push({ m: s, x: ox, phase: i * 0.42 + k * 0.5 + (c.x + 20) * 0.01 });
      }
    }

    // 列底光晕（选中时亮）
    c.halo = ring(3.0, 3.5, p.accent, { opacity: 0.0, seg: 64 });
    c.halo.rotation.x = -Math.PI / 2;
    c.halo.position.set(c.x, 0.06, 0);
    host.scene.add(c.halo);

    // 列标题
    c.top = textSprite(c.title, { color: p.accent, height: 0.5 });
    c.top.position.set(c.x, 5.35, 0);
    host.scene.add(c.top);

    // 三类共享资源（写在列脚下：说明「线程共享进程资源」）
    const res = textSprite('共享：代码段 · 数据段 · 打开文件', { color: p.text3, height: 0.3 });
    res.position.set(c.x, -0.55, 0);
    host.scene.add(res);

    if (c.key === 'ult') {
      // ULT 特写：三颗小球只在用户层打转，内核毫无察觉
      c.spin = [];
      for (let i = 0; i < 3; i++) {
        const s = sphere(0.14, COLORS[i], { emissive: COLORS[i], emissiveIntensity: 0.9 });
        host.scene.add(s);
        c.spin.push({ m: s, a: (i / 3) * Math.PI * 2 });
      }
    }
  });

  /* ---------------------------------------------------------- 说明栏 */
  const note = textSprite('三种模型的核心差别：内核到底登记了几个「可调度单位」。', {
    color: p.text2, height: 0.36,
  });
  note.position.set(0, -1.35, 0);
  host.scene.add(note);

  const setNote = (t) => retext(note, t, { color: p.text2, height: 0.36 });

  /* ---------------------------------------------------------- 交互 */
  let cur = 'all';

  const apply = (key) => {
    cur = key;
    COLS.forEach((c) => {
      const on = key === 'all' || key === c.key;
      c.halo.material.opacity = on && key !== 'all' ? 0.5 : 0.0;
      c.top.material.opacity = on ? 1 : 0.28;
      c.hw.m.material.opacity = on ? 0.9 : 0.22;
      c.ke.m.material.opacity = on ? 0.9 : 0.22;
      c.us.m.material.opacity = on ? 0.9 : 0.22;
      c.th.forEach((t) => { t.m.material.opacity = on ? 0.95 : 0.25; });
      c.tokens.forEach((t) => { t.m.visible = on; });
      if (c.key === 'ult' && c.spin) c.spin.forEach((s) => { s.m.visible = on; });
    });
    const c = COLS.find((x) => x.key === key);
    setNote(c ? c.note : '三种模型的核心差别：内核到底登记了几个「可调度单位」。');
    host.cap(
      c
        ? `<b>${c.title}</b> —— ${c.note}`
        : '线程是 CPU 调度的基本单位，进程是资源分配的基本单位。三列并排对比三种映射关系。'
    );
  };

  const btns = host.toolbar([
    { label: '三种对比', active: true, onClick: () => { apply('all'); pick(btns[0]); } },
    { label: '用户级 ULT', onClick: () => { apply('ult'); pick(btns[1]); } },
    { label: '内核级 KLT', onClick: () => { apply('klt'); pick(btns[2]); } },
    { label: '多对多 M:N', onClick: () => { apply('mn'); pick(btns[3]); } },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  host.hint('通道数量 = 内核登记的线程数；小球是「执行权」在硬件与用户线程之间往返。');
  apply('all');

  /* ----------------------------------------------------------- 动画 */
  host.onTick((t) => {
    COLS.forEach((c, ci) => {
      c.tokens.forEach((tk, i) => {
        const u = ((t * 0.36 + tk.phase) % 1 + 1) % 1;
        const down = u < 0.5 ? u * 2 : (1 - u) * 2;
        tk.m.position.set(tk.x, Y3 - 0.7 - down * (Y3 - Y1 - 0.75), 0);
        tk.m.position.y += Math.sin(t * 2.4 + i) * 0.03;
      });
      if (c.spin) {
        c.spin.forEach((s) => {
          s.a += 0.012;
          s.m.position.set(c.x + Math.cos(s.a) * 1.5, Y2 + 0.72 + Math.sin(t * 2 + s.a) * 0.12, Math.sin(s.a) * 1.5);
        });
      }
      c.hw.m.rotation.y = Math.sin(t * 0.5 + ci) * 0.01;
      if (cur !== 'all' && cur !== c.key) return;
      const glow = 0.1 + Math.sin(t * 1.8 + ci) * 0.06;
      c.us.m.material.emissiveIntensity = glow;
      c.ke.m.material.emissiveIntensity = glow * 0.8;
    });
  });
}
