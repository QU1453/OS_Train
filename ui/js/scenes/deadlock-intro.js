/**
 * deadlock-intro.js —— 2.4.1 死锁的概念
 *
 * 四种视角：
 *   ① 环路等待：进程—资源交替成环，六个箭头首尾咬死
 *   ② 四个必要条件：四根柱子托住横梁，抽掉任一根横梁就塌
 *   ③ 三概念辨析：死锁 / 饥饿 / 死循环
 *   ④ 四种处理策略：预防 / 避免 / 检测与解除 / 鸵鸟
 */
import { THREE, SceneHost, textSprite, retext, box, sphere, cylinder, arrow, grid, line } from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0.4, 10.6, 15.6],
    target: [0, 1.5, 0],
    minDist: 12,
    maxDist: 46,
    maxPolarAngle: Math.PI * 0.48,
    label: '死锁：四个必要条件',
  });
  const p = host.p;
  host.scene.add(grid(38));

  const C = (color, height = 0.3) => ({ color, height });
  const lbl = (text, x, y, z, color, height = 0.32) => {
    const s = textSprite(text, C(color, height));
    s.position.set(x, y, z);
    host.scene.add(s);
    return s;
  };
  const cardBg = (g, x, y, w, h, col) => {
    const bg = box(w, h, 0.12, p.surface, { edges: true, edgeColor: col, pos: [x, y, 0] });
    g.add(bg);
    return bg;
  };
  const onRing = (deg, r, y) => new THREE.Vector3(
    Math.cos((deg * Math.PI) / 180) * r,
    y,
    Math.sin((deg * Math.PI) / 180) * r,
  );
  const clip = (a, b, k) => {
    const d = b.clone().sub(a);
    const l = d.length();
    return [a.clone().addScaledVector(d, k / l), b.clone().addScaledVector(d, -k / l)];
  };

  /* ================================================ ① 环路等待 gCycle */
  const gCycle = new THREE.Group();
  host.scene.add(gCycle);

  gCycle.add(lbl('① 环路等待：每个人都占着别人要的东西', 0, 6.0, 0, p.err, 0.46));

  const R = 4.9;
  const NY = 1.35;
  const procDeg = [90, 210, 330];
  const resDeg = [30, 150, 270];

  const procs = [];
  procDeg.forEach((deg, i) => {
    const v = onRing(deg, R, NY);
    const m = box(2.1, 0.95, 1.7, p.def, {
      opacity: 0.6, emissive: p.def, emissiveIntensity: 0.15, pos: [v.x, v.y, v.z],
    });
    procs.push(m);
    gCycle.add(m);
    const t = textSprite(`P${i + 1}`, C(p.text1, 0.42));
    t.position.set(v.x, v.y + 0.95, v.z);
    gCycle.add(t);
    const sub = textSprite(['持有 R1，要 R2', '持有 R2，要 R3', '持有 R3，要 R1'][i], C(p.text2, 0.26));
    sub.position.set(v.x, v.y - 0.85, v.z);
    gCycle.add(sub);
  });

  const ress = [];
  resDeg.forEach((deg, i) => {
    const v = onRing(deg, R, NY);
    const m = cylinder(0.62, 0.62, 1.0, p.key, { emissive: p.key, emissiveIntensity: 0.25 });
    m.position.set(v.x, v.y, v.z);
    ress.push(m);
    gCycle.add(m);
    const t = textSprite(`R${i + 1}`, C(p.text1, 0.38));
    t.position.set(v.x, v.y + 0.95, v.z);
    gCycle.add(t);
  });

  gCycle.add(lbl('打印机', 0, 3.2, 4.9, p.text2, 0.26));
  gCycle.add(lbl('扫描仪', -4.9, 3.2, -1.6, p.text2, 0.26));
  gCycle.add(lbl('刻录机', 4.9, 3.2, -1.6, p.text2, 0.26));

  /* 持有：R_i → P_i（实线，memo） */
  const holdArrows = [];
  for (let i = 0; i < 3; i += 1) {
    const [a, b] = clip(onRing(resDeg[i], R, NY), onRing(procDeg[i], R, NY), 0.95);
    const ar = arrow(a, b, p.memo, { headLen: 0.3, headR: 0.11 });
    holdArrows.push(ar);
    gCycle.add(ar);
  }
  /* 请求：P_i → R_(i+1)（实线，err） */
  const reqArrows = [];
  for (let i = 0; i < 3; i += 1) {
    const [a, b] = clip(onRing(procDeg[i], R, NY), onRing(resDeg[(i + 1) % 3], R, NY), 0.95);
    const ar = arrow(a, b, p.err, { headLen: 0.3, headR: 0.11 });
    reqArrows.push(ar);
    gCycle.add(ar);
  }

  gCycle.add(lbl('实线红 = 申请（拿不到，等）   浅绿 = 已占有', 0, 4.9, 0, p.text2, 0.3));
  const cycTx = lbl('P1→R2→P2→R3→P3→R1→P1  形成环路 → 死锁', 0, -0.9, 0, p.err, 0.34);
  gCycle.add(cycTx);

  /* ============================================= ② 四个必要条件 gCond */
  const gCond = new THREE.Group();
  host.scene.add(gCond);

  gCond.add(lbl('② 四个必要条件「互不请循」——缺一条就不成死锁', 0, 5.5, 0, p.warn, 0.46));

  const condNames = ['① 互斥\n资源不能共享', '② 不可剥夺\n不能被抢走', '③ 请求并保持\n占着还要', '④ 循环等待\n首尾相接'];
  const condShort = ['互斥', '不可剥夺', '请求并保持', '循环等待'];
  const condX = [-6.2, -2.05, 2.05, 6.2];
  const condCol = [p.warn, p.err, p.memo, p.key];
  const pillars = [];
  condX.forEach((x, i) => {
    const m = box(1.7, 3.0, 1.7, condCol[i], {
      opacity: 0.55, emissive: condCol[i], emissiveIntensity: 0.18, pos: [x, 1.9, 0],
    });
    pillars.push(m);
    gCond.add(m);
    const t = textSprite(condNames[i].split('\n')[0], C(p.text1, 0.32));
    t.position.set(x, 1.9, 1.0);
    gCond.add(t);
    const s = textSprite(condNames[i].split('\n')[1], C(p.text2, 0.26));
    s.position.set(x, 1.3, 1.0);
    gCond.add(s);
  });

  const beam = box(14.8, 0.34, 0.7, p.ok, {
    emissive: p.ok, emissiveIntensity: 0.35, pos: [0, 3.6, 0],
  });
  gCond.add(beam);
  const beamTx = lbl('四条同时成立 → 可能死锁', 0, 4.35, 0, p.ok, 0.34);
  gCond.add(beamTx);
  const condTx = lbl('必要条件 ≠ 充分条件：全成立也可能没死锁', 0, -0.85, 0, p.err, 0.32);
  gCond.add(condTx);

  /* ================================================== ③ 三概念 gVS */
  const gVS = new THREE.Group();
  host.scene.add(gVS);

  gVS.add(lbl('③ 死锁 / 饥饿 / 死循环 —— 别混为一谈', 0, 5.4, 0, p.key, 0.46));

  const vsData = [
    { name: '死锁', col: p.err, rows: ['多进程互相等待', '永久阻塞', '不能自行解除'] },
    { name: '饥饿', col: p.warn, rows: ['长期轮不到资源', '可能被阻塞', '可能自行解除'] },
    { name: '死循环', col: p.memo, rows: ['程序逻辑写错', '不阻塞，占着 CPU', '不会自行解除'] },
  ];
  const vsX = [-4.6, 0, 4.6];
  vsData.forEach((d, i) => {
    const x = vsX[i];
    cardBg(gVS, x, 1.9, 4.3, 4.4, d.col);
    const h = textSprite(d.name, C(d.col, 0.46));
    h.position.set(x, 3.75, 0.16);
    gVS.add(h);
    d.rows.forEach((r, j) => {
      const s = textSprite(r, C(p.text2, 0.28));
      s.position.set(x, 3.0 - j * 0.66, 0.16);
      gVS.add(s);
    });
  });
  gVS.add(lbl('只有死锁是「环」；饥饿是「排队不公」；死循环是「代码错」', 0, -0.85, 0, p.text2, 0.3));

  /* ============================================= ④ 处理策略 gStg */
  const gStg = new THREE.Group();
  host.scene.add(gStg);

  gStg.add(lbl('④ 四种处理策略：从最保守到最放任', 0, 5.4, 0, p.ok, 0.46));

  const stg = [
    { n: '死锁预防', c: p.err, rows: ['静态：破坏四条件之一', '保守，资源利用率低'] },
    { n: '死锁避免', c: p.warn, rows: ['动态：每次分配先算安全', '银行家算法，不破坏条件'] },
    { n: '检测与解除', c: p.memo, rows: ['允许发生，定期查图', '剥夺 / 撤销 / 回退'] },
    { n: '鸵鸟策略', c: p.key, rows: ['假装没这回事', '真出问题就重启'] },
  ];
  stg.forEach((d, i) => {
    const x = -5.4 + i * 3.6;
    cardBg(gStg, x, 2.1, 3.3, 3.9, d.c);
    const h = textSprite(d.n, C(d.c, 0.38));
    h.position.set(x, 3.45, 0.16);
    gStg.add(h);
    d.rows.forEach((r, j) => {
      const s = textSprite(r, C(p.text2, 0.26));
      s.position.set(x, 2.75 - j * 0.6, 0.16);
      gStg.add(s);
    });
  });
  gStg.add(lbl('考点：四条件是「必要」不是「充分」；避免 ≠ 预防', 0, -0.85, 0, p.text2, 0.3));

  /* ====================================================== 交互 */
  const NOTES = {
    cycle: '死锁 = 一组进程各自占有资源、又都在等别人手里的资源，形成环路，谁也动不了。',
    cond: '互斥、不可剥夺、请求并保持、循环等待——四条同时满足才可能死锁，破掉任一条即可预防。',
    vs: '死锁是环、饥饿是排队不公、死循环是逻辑错；判断标准看"是否阻塞"和"能否自行解除"。',
    stg: '预防破坏条件、避免动态检查、检测与解除事后补救、鸵鸟不管——考试最爱问四者区别。',
  };

  const note = textSprite(NOTES.cycle, C(p.text2, 0.32));
  note.position.set(0, -1.6, 0);
  host.scene.add(note);

  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  const apply = (key) => {
    gCycle.visible = key === 'cycle';
    gCond.visible = key === 'cond';
    gVS.visible = key === 'vs';
    gStg.visible = key === 'stg';
    retext(note, NOTES[key], C(p.text2, 0.32));
    const title = key === 'cycle' ? '环路等待'
      : key === 'cond' ? '四个必要条件' : key === 'vs' ? '三概念辨析' : '四种处理策略';
    host.cap(`<b>${title}</b> —— ${NOTES[key]}`);
  };

  const btns = host.toolbar([
    { label: '环路等待', active: true, onClick: () => { apply('cycle'); pick(btns[0]); } },
    { label: '四个必要条件', onClick: () => { apply('cond'); pick(btns[1]); } },
    { label: '死锁/饥饿/死循环', onClick: () => { apply('vs'); pick(btns[2]); } },
    { label: '四种策略', onClick: () => { apply('stg'); pick(btns[3]); } },
  ]);

  host.hint('口诀：<b>互不请循</b>——互斥、不可剥夺、请求并保持、循环等待；四条是<b>必要</b>条件，不是充分条件。');
  apply('cycle');

  /* ====================================================== 动画 */
  host.onTick((t) => {
    /* ① 箭头沿环依次亮起，最后整环红了 */
    if (gCycle.visible) {
      const order = [holdArrows[0], reqArrows[0], holdArrows[1], reqArrows[1], holdArrows[2], reqArrows[2]];
      const T = 6.0;
      const u = ((t % T) + T) % T;
      order.forEach((g, i) => {
        const d = (u - i * 0.55 + T) % T;
        const hot = d < 0.9;
        const a = hot ? 0.85 : 0.32 + Math.abs(Math.sin(t * 1.4 + i)) * 0.12;
        g.children.forEach((c) => { if (c.material) c.material.opacity = a; });
      });
      procs.forEach((m, i) => {
        m.material.emissiveIntensity = 0.15 + Math.abs(Math.sin(t * 1.8 + i * 1.1)) * 0.22;
      });
      ress.forEach((m, i) => {
        m.material.emissiveIntensity = 0.2 + Math.abs(Math.sin(t * 1.8 + i * 1.1 + 0.9)) * 0.3;
      });
      retext(cycTx, 'P1→R2→P2→R3→P3→R1→P1  形成环路 → 死锁', C(p.err, 0.34));
    }

    /* ② 依次抽掉一根柱子 → 横梁塌，死锁不成立 */
    if (gCond.visible) {
      const T = 16;
      const u = ((t % T) + T) % T / T;
      const k = Math.floor(u * 4);
      const ph = (u * 4) % 1;
      const ramp = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
      const sink = ph < 0.25 ? ramp(ph, 0.08, 0.25) : ph > 0.82 ? 1 - ramp(ph, 0.82, 0.98) : 1;

      pillars.forEach((m, i) => {
        const down = i === k ? sink : 0;
        m.position.y = 1.9 - down * 3.0;
        m.material.emissiveIntensity = i === k ? 0.12 : 0.2 + Math.abs(Math.sin(t * 1.6 + i)) * 0.12;
      });

      const tilt = (k === 0 ? 1 : k === 3 ? -1 : 0) * sink * 0.14;
      beam.rotation.z = tilt;
      beam.position.y = 3.6 - sink * 0.25;
      beam.material.color.set(sink > 0.5 ? p.err : p.ok);
      beam.material.emissive.set(sink > 0.5 ? p.err : p.ok);
      beam.material.emissiveIntensity = sink > 0.5 ? 0.45 : 0.3 + Math.abs(Math.sin(t * 2)) * 0.15;

      retext(beamTx,
        sink > 0.5 ? `抽掉「${condShort[k]}」→ 横梁塌了，死锁不成立` : '四条同时成立 → 可能死锁',
        C(sink > 0.5 ? p.err : p.ok, 0.34));
    }

    /* ④ 策略卡轻微脉冲 */
    if (gStg.visible) {
      gStg.children.forEach((c) => {
        if (c.type === 'Sprite' && c.material) c.material.opacity = 0.85 + Math.abs(Math.sin(t * 1.1)) * 0.15;
      });
    }
  });
}
