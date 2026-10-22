/**
 * monitor.js —— 2.3.8 管程（Monitor）
 *
 * 四种视角：
 *   ① 管程结构：半透明外壳 = 封装；局部数据在里；过程入口在外
 *   ② wait / signal：条件变量队列；wait 阻塞并释放管程，signal 唤醒一个
 *   ③ 生产者-消费者：管程伪代码 + buffer / count 联动
 *   ④ 对比信号量：4 行维度对照
 */
import { THREE, SceneHost, textSprite, retext, box, sphere, cylinder, arrow, grid, line } from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0.5, 9.2, 15.8],
    target: [0, 1.7, 0],
    minDist: 11,
    maxDist: 44,
    maxPolarAngle: Math.PI * 0.48,
    label: '管程：封装 + 条件变量',
  });
  const p = host.p;
  host.scene.add(grid(36));

  const C = (color, height = 0.3) => ({ color, height });
  const lbl = (text, x, y, z, color, height = 0.32) => {
    const s = textSprite(text, C(color, height));
    s.position.set(x, y, z);
    host.scene.add(s);
    return s;
  };

  /* ================================================== ① 管程结构 gStruct */
  const SW = 10.6;
  const SH = 4.8;
  const SD = 6.0;
  const SY = 2.7;

  const gStruct = new THREE.Group();
  host.scene.add(gStruct);

  gStruct.add(lbl('管程（Monitor）· 任一时刻至多一个进程在里面', 0, 6.1, 0, p.def, 0.46));

  const shell = box(SW, SH, SD, p.def, {
    opacity: 0.07, edges: true, edgeColor: p.def, edgeOpacity: 0.42, pos: [0, SY, 0],
  });
  gStruct.add(shell);

  /* 四根角柱，让"外壳"有体积感 */
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const c = cylinder(0.08, 0.08, SH, p.def, { opacity: 0.38, emissive: p.def, emissiveIntensity: 0.2 });
    c.position.set(sx * SW / 2, SY, sz * SD / 2);
    gStruct.add(c);
  });

  /* 局部数据：buffer[N] */
  gStruct.add(lbl('局部数据（只许过程访问）', 0, 2.35, -1.9, p.text2, 0.3));
  const slots = [];
  for (let i = 0; i < 6; i += 1) {
    const s = box(1.2, 0.6, 1.2, p.surface, {
      emissive: p.ok, emissiveIntensity: 0.05,
      pos: [(i - 2.5) * 1.45, 1.35, -1.6],
    });
    slots.push(s);
    gStruct.add(s);
  }
  const countTx = lbl('count = 3', 0, 0.6, -1.6, p.ok, 0.32);
  gStruct.add(countTx);

  /* 三个过程入口（门） */
  const doors = [];
  ['produce(x)', 'consume()', 'init()'].forEach((name, i) => {
    const x = (i - 1) * 3.5;
    const d = box(2.6, 2.1, 0.14, p.surface2 ?? p.surface, {
      edges: true, edgeColor: p.def, edgeOpacity: 0.45, emissive: p.def, emissiveIntensity: 0.08,
      pos: [x, 1.4, SD / 2],
    });
    doors.push(d);
    gStruct.add(d);
    gStruct.add(lbl(name, x, 2.75, SD / 2 + 0.1, p.def, 0.32));
  });

  /* 入口队列 */
  const qBalls = [];
  for (let i = 0; i < 3; i += 1) {
    const b = sphere(0.26, p.text3, {});
    b.position.set(0, 0.55, 4.1 + i * 0.85);
    qBalls.push(b);
    gStruct.add(b);
  }
  gStruct.add(lbl('入口队列（想进来，得先拿到管程锁）', 0, 0.55, 7.15, p.text2, 0.3));

  const runBall = sphere(0.26, p.accent, { emissive: p.accent, emissiveIntensity: 0.85 });
  gStruct.add(runBall);
  const inTx = lbl('管程内进程数 = 0', 0, 4.9, 0, p.ok, 0.34);
  gStruct.add(inTx);

  /* =============================================== ② 条件变量 gCV */
  const gCV = new THREE.Group();
  host.scene.add(gCV);

  gCV.add(lbl('② 条件变量：进程在管程内等待某条件成立', 0, 5.5, 0, p.warn, 0.44));

  const cvBody = box(4.6, 3.2, 3.4, p.def, {
    opacity: 0.08, edges: true, edgeColor: p.def, edgeOpacity: 0.4, pos: [0, 2.0, 0],
  });
  gCV.add(cvBody);
  gCV.add(lbl('管程内', 0, 2.0, 1.85, p.def, 0.3));

  const innerBall = sphere(0.28, p.accent, { emissive: p.accent, emissiveIntensity: 0.85 });
  innerBall.position.set(0, 1.55, 0);
  gCV.add(innerBall);

  const mkQueue = (x, name, color) => {
    const g = new THREE.Group();
    g.add(lbl(name, x, 3.05, 0, color, 0.32));
    const balls = [];
    for (let i = 0; i < 4; i += 1) {
      const b = sphere(0.24, color, { emissive: color, emissiveIntensity: 0.55 });
      b.position.set(x, 0.7, -1.65 + i * 1.1);
      balls.push(b);
      g.add(b);
    }
    gCV.add(g);
    return { balls };
  };
  const qf = mkQueue(-5.3, 'notfull 等待队列', p.memo);
  mkQueue(5.3, 'notempty 等待队列', p.key);

  const awWait = arrow(new THREE.Vector3(-2.05, 1.35, 0.6), new THREE.Vector3(-4.65, 0.95, 0.9), p.memo);
  const awSignal = arrow(new THREE.Vector3(-4.65, 2.15, -0.9), new THREE.Vector3(-2.05, 2.35, -0.6), p.ok);
  gCV.add(awWait, awSignal);
  gCV.add(lbl('wait()', -4.3, 1.5, 2.0, p.memo, 0.34));
  gCV.add(lbl('signal()', -4.2, 2.95, -2.1, p.ok, 0.34));
  gCV.add(lbl('阻塞 + 释放管程', -4.2, 0.25, 2.0, p.text2, 0.28));
  gCV.add(lbl('唤醒一个；无人等待则丢失', -3.6, 3.55, -2.1, p.text2, 0.28));
  gCV.add(lbl('条件变量没有值，不能当信号量用', 0, -0.55, 1.2, p.err, 0.32));

  /* ============================================ ③ 生产者-消费者 gPC */
  const gPC = new THREE.Group();
  host.scene.add(gPC);

  const cardBg = (g, x, y, w, h, col) => {
    const bg = box(w, h, 0.12, p.surface, { edges: true, edgeColor: col, pos: [x, y, 0] });
    g.add(bg);
    return bg;
  };
  const codeRow = (g, text, xLeft, y, color, height = 0.3) => {
    const s = textSprite(text, C(color, height));
    s.position.set(xLeft + s.scale.x / 2, y, 0.14);
    g.add(s);
    return s;
  };

  cardBg(gPC, -3.55, 2.35, 6.4, 4.5, p.warn);
  cardBg(gPC, 3.55, 2.35, 6.4, 4.5, p.memo);

  codeRow(gPC, 'procedure produce(x):', -6.4, 4.05, p.warn, 0.38);
  codeRow(gPC, 'if count == N then notfull.wait();', -6.4, 3.5, p.err);
  codeRow(gPC, 'buffer[in] = x;  in = (in+1) % N;', -6.4, 3.05, p.text2);
  codeRow(gPC, 'count = count + 1;', -6.4, 2.6, p.text2);
  codeRow(gPC, 'notempty.signal();  // 叫醒消费者', -6.4, 2.15, p.ok);
  codeRow(gPC, '★ 不写 P/V：进入管程即互斥', -6.4, 1.3, p.key, 0.28);

  codeRow(gPC, 'procedure consume():', 0.6, 4.05, p.memo, 0.38);
  codeRow(gPC, 'if count == 0 then notempty.wait();', 0.6, 3.5, p.err);
  codeRow(gPC, 'x = buffer[out];  out = (out+1) % N;', 0.6, 3.05, p.text2);
  codeRow(gPC, 'count = count - 1;', 0.6, 2.6, p.text2);
  codeRow(gPC, 'notfull.signal();  // 叫醒生产者', 0.6, 2.15, p.ok);
  codeRow(gPC, '★ 条件变量无值，只负责排队', 0.6, 1.3, p.key, 0.28);

  const pcSlots = [];
  for (let i = 0; i < 6; i += 1) {
    const s = box(1.15, 0.58, 1.15, p.surface, {
      emissive: p.ok, emissiveIntensity: 0.05, pos: [(i - 2.5) * 1.4, 0.45, 2.9],
    });
    pcSlots.push(s);
    gPC.add(s);
  }
  const pcCount = lbl('count = 3 / 6', 0, 1.25, 2.9, p.ok, 0.34);
  gPC.add(pcCount);
  gPC.add(lbl('buffer[N]', 4.9, 0.45, 2.9, p.text2, 0.28));

  /* ================================================ ④ 对比 gCmp */
  const gCmp = new THREE.Group();
  host.scene.add(gCmp);

  gCmp.add(lbl('管程 vs 信号量', 0, 5.3, 0, p.key, 0.48));

  const cols = [-5.2, 0.1, 5.0];
  const head = ['维度', '管程', '信号量'];
  head.forEach((t, i) => gCmp.add(lbl(t, cols[i], 4.25, 0, i === 0 ? p.text1 : i === 1 ? p.memo : p.warn, 0.4)));

  const rows = [
    ['同步手段', '条件变量 wait / signal', 'P / V 原语'],
    ['互斥实现', '编译器自动保证', '程序员自己写 P/V'],
    ['封装性', '封装数据与过程，信息隐藏', '分散在程序里，易漏易错'],
    ['核心原语', 'wait/signal，无计数值', 'P/V，有整型计数值'],
  ];
  rows.forEach((r, i) => {
    const y = 3.4 - i * 0.95;
    gCmp.add(lbl(r[0], cols[0], y, 0, p.text1, 0.32));
    gCmp.add(lbl(r[1], cols[1], y, 0, p.memo, 0.32));
    gCmp.add(lbl(r[2], cols[2], y, 0, p.warn, 0.32));
    if (i < rows.length - 1) {
      const ln = line([new THREE.Vector3(-7.6, y - 0.47, 0), new THREE.Vector3(7.4, y - 0.47, 0)], 0x9AA6B4, { opacity: 0.35, dash: 0.22, gap: 0.16 });
      gCmp.add(ln);
    }
  });
  gCmp.add(lbl('口诀：封装互斥自动管，条件变量等唤醒', 0, 0.5, 0, p.ok, 0.36));

  /* ===================================================== 交互 */
  const NOTES = {
    struct: '管程 = 名称 + 局部数据 + 一组过程 + 初始化语句；任一时刻只有一个进程在管程内执行。',
    cv: 'wait() 阻塞并把 PCB 挂到条件变量队列，同时释放管程；signal() 唤醒一个，没人等就丢失。',
    pc: '互斥交给编译器，同步交给条件变量；count 满就让生产者 wait，空就让消费者 wait。',
    cmp: '管程把"互斥 + 同步"都封起来；信号量把两件事都留给程序员自己拼。',
  };

  let note = textSprite(NOTES.struct, C(p.text2, 0.32));
  note.position.set(0, -1.5, 0);
  host.scene.add(note);

  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  const apply = (key) => {
    gStruct.visible = key === 'struct';
    gCV.visible = key === 'cv';
    gPC.visible = key === 'pc';
    gCmp.visible = key === 'cmp';
    retext(note, NOTES[key], C(p.text2, 0.32));
    const title = key === 'struct' ? '管程结构'
      : key === 'cv' ? '条件变量' : key === 'pc' ? '生产者-消费者' : '对比信号量';
    host.cap(`<b>${title}</b> —— ${NOTES[key]}`);
  };

  const btns = host.toolbar([
    { label: '管程结构', active: true, onClick: () => { apply('struct'); pick(btns[0]); } },
    { label: 'wait / signal', onClick: () => { apply('cv'); pick(btns[1]); } },
    { label: '生产者-消费者', onClick: () => { apply('pc'); pick(btns[2]); } },
    { label: '对比信号量', onClick: () => { apply('cmp'); pick(btns[3]); } },
  ]);

  host.hint('记四样：<b>名、数、操、初</b>；记一句话：<b>封装互斥自动管，条件变量等唤醒</b>。');
  apply('struct');

  /* ===================================================== 动画 */
  const ramp = (u, a, b) => Math.max(0, Math.min(1, (u - a) / (b - a)));

  host.onTick((t) => {
    /* ① 一个进程进管程 → 干活 → 出来；期间入口队列不动 */
    if (gStruct.visible) {
      const T = 13;
      const u = ((t % T) + T) % T / T;
      const qz = 4.1;
      const inZ = 1.9;
      let z = qz;
      let y = 0.55;
      let inside = false;
      if (u < 0.1) {
        z = qz + Math.sin(t * 5) * 0.05;
      } else if (u < 0.26) {
        z = qz + (inZ - qz) * ramp(u, 0.1, 0.26);
        y = 0.55 + 0.6 * ramp(u, 0.1, 0.26);
      } else if (u < 0.62) {
        z = inZ;
        y = 1.15;
        inside = true;
      } else if (u < 0.8) {
        z = inZ + (qz - inZ) * ramp(u, 0.62, 0.8);
        y = 1.15 - 0.6 * ramp(u, 0.62, 0.8);
      } else {
        z = qz;
      }
      runBall.position.set(0, y, z);

      shell.material.opacity = inside ? 0.16 : 0.07;
      shell.material.emissive = new THREE.Color(inside ? p.warn : p.def);
      shell.material.emissiveIntensity = inside ? 0.22 + Math.abs(Math.sin(t * 4)) * 0.1 : 0;
      retext(inTx, inside ? '管程内进程数 = 1（其他人在门外等）' : '管程内进程数 = 0', C(inside ? p.warn : p.ok, 0.34));

      doors.forEach((d, i) => {
        d.material.emissiveIntensity = inside && i === 0 ? 0.5 : 0.08;
      });

      const n = 3;
      retext(countTx, `count = ${inside ? 4 : n}`, C(inside ? p.warn : p.ok, 0.32));
      slots.forEach((s, i) => {
        s.material.emissiveIntensity = i < (inside ? 4 : n) ? 0.42 : 0.05;
      });

      qBalls.forEach((b, i) => {
        b.position.z = 4.1 + i * 0.85 + (inside ? 0.3 * ramp(u, 0.26, 0.42) : 0);
        b.material.color.set(inside ? p.warn : p.text3);
      });
    }

    /* ② 条件变量队列呼吸，wait / signal 箭头交替亮 */
    if (gCV.visible) {
      qf.balls.forEach((b, i) => {
        b.material.emissiveIntensity = 0.35 + Math.abs(Math.sin(t * 2.2 + i * 0.6)) * 0.45;
      });
      innerBall.position.y = 1.55 + Math.sin(t * 1.6) * 0.1;
      const w = 0.4 + Math.abs(Math.sin(t * 2)) * 0.45;
      awWait.children.forEach((c) => { if (c.material) c.material.opacity = w; });
      awSignal.children.forEach((c) => { if (c.material) c.material.opacity = 0.4 + Math.abs(Math.sin(t * 2 + 2)) * 0.45; });
    }

    /* ③ buffer 填充 / 清空循环 */
    if (gPC.visible) {
      const T = 14;
      const u = ((t % T) + T) % T / T;
      const n = u < 0.5 ? Math.min(6, Math.floor(u * 2 * 7)) : Math.max(0, 6 - Math.floor((u - 0.5) * 2 * 7));
      pcSlots.forEach((s, i) => {
        s.material.emissiveIntensity = i < n ? 0.45 : 0.05;
        s.material.color.set(i < n ? p.ok : p.surface);
      });
      retext(pcCount, `count = ${n} / 6`, C(n === 6 ? p.err : n === 0 ? p.warn : p.ok, 0.34));
    }

    /* ④ 对比表：行序微亮 */
    if (gCmp.visible) {
      gCmp.children.forEach((c) => {
        if (c.type === 'Sprite' && c.material) c.material.opacity = 0.82 + Math.abs(Math.sin(t * 1.2)) * 0.18;
      });
    }
  });
}
