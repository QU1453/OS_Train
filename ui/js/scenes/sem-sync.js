/**
 * sem-sync.js —— 用信号量实现进程同步与互斥（2.3.4）
 *
 * 同一个工具，两种用法，区别只在「初值」：
 *   ① 互斥：mutex 初值 1，P/V 把临界区夹在中间 —— 是「抢」
 *   ② 同步：s 初值 0，前趋先 V、后继后 P —— 是「等」
 *   ③ 代码对照：两种写法并排放
 *   ④ 常见错误：P/V 不成对、两个 P 顺序不一致（死锁）
 */
import {
  THREE,
  SceneHost,
  textSprite,
  retext,
  box,
  sphere,
  grid,
  line,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [1.2, 9.4, 16.2],
    target: [0, 1.5, 0],
    minDist: 12,
    maxDist: 44,
    maxPolarAngle: Math.PI * 0.48,
    label: '信号量：互斥 vs 同步',
  });
  const p = host.p;
  host.scene.add(grid(34));

  const MX = -5.7;
  const SX = 5.7;
  const C = (color, height = 0.3) => ({ color, height });
  const lbl = (text, x, y, z, color, height = 0.32) => {
    const s = textSprite(text, C(color, height));
    s.position.set(x, y, z);
    host.scene.add(s);
    return s;
  };

  /* ===================================================== ① 互斥 gM */
  const gM = new THREE.Group();
  host.scene.add(gM);
  const mTitle = textSprite('① 互斥 · sem mutex = 1', C(p.warn, 0.46));
  mTitle.position.set(MX, 4.15, 0);
  gM.add(mTitle);
  gM.add(lbl('临界资源（打印机）', MX, 1.0, 0, p.text1, 0.3));

  const mRes = box(2.5, 0.55, 2.0, p.def, {
    opacity: 0.55, emissive: p.def, emissiveIntensity: 0.12, pos: [MX, 0.55, 0],
  });
  gM.add(mRes);

  const mA = box(2.2, 0.4, 1.3, p.def, {
    opacity: 0.55, emissive: p.def, emissiveIntensity: 0.1, pos: [MX, 0.5, -3.2],
  });
  const mB = box(2.2, 0.4, 1.3, p.accent, {
    opacity: 0.55, emissive: p.accent, emissiveIntensity: 0.1, pos: [MX, 0.5, 3.2],
  });
  gM.add(mA, mB);
  const lbA = textSprite('进程 A', C(p.text2, 0.3));
  lbA.position.set(MX, 0.84, -3.95);
  gM.add(lbA);
  const lbB = textSprite('进程 B', C(p.text2, 0.3));
  lbB.position.set(MX, 0.84, 3.95);
  gM.add(lbB);

  const mTa = sphere(0.23, p.def, { emissive: p.def, emissiveIntensity: 0.9 });
  const mTb = sphere(0.23, p.accent, { emissive: p.accent, emissiveIntensity: 0.9 });
  gM.add(mTa, mTb);

  const mVal = textSprite('mutex = 1', C(p.ok, 0.38));
  mVal.position.set(MX, 2.55, 0);
  gM.add(mVal);
  const mState = textSprite('空闲：mutex = 1，谁先 P 到谁进', C(p.text2, 0.3));
  mState.position.set(MX, -0.8, 0);
  gM.add(mState);

  /* ===================================================== ② 同步 gS */
  const gS = new THREE.Group();
  host.scene.add(gS);
  const sTitle = textSprite('② 同步 · sem s = 0', C(p.memo, 0.46));
  sTitle.position.set(SX, 4.15, 0);
  gS.add(sTitle);

  const sS1 = box(2.0, 0.9, 2.0, p.memo, {
    opacity: 0.55, emissive: p.memo, emissiveIntensity: 0.12, pos: [SX - 3.15, 0.75, 0],
  });
  const sS2 = box(2.0, 0.9, 2.0, p.key, {
    opacity: 0.55, emissive: p.key, emissiveIntensity: 0.12, pos: [SX + 3.15, 0.75, 0],
  });
  gS.add(sS1, sS2);
  gS.add(lbl('S1（前趋）', SX - 3.15, 1.45, 0, p.text1, 0.3));
  gS.add(lbl('S2（后继）', SX + 3.15, 1.45, 0, p.text1, 0.3));

  const gate = box(0.22, 2.05, 2.6, p.err, {
    opacity: 0.45, emissive: p.err, emissiveIntensity: 0.32, pos: [SX, 1.1, 0],
  });
  gS.add(gate);
  const gateLb = textSprite('同步点 P(s)', C(p.err, 0.3));
  gateLb.position.set(SX, 2.45, 0);
  gS.add(gateLb);
  const sVal = textSprite('s = 0 → S2 阻塞等待', C(p.warn, 0.36));
  sVal.position.set(SX, 3.15, 0);
  gS.add(sVal);

  const sTa = sphere(0.23, p.memo, { emissive: p.memo, emissiveIntensity: 0.9 });
  const sTb = sphere(0.23, p.key, { emissive: p.key, emissiveIntensity: 0.9 });
  gS.add(sTa, sTb);
  const sFlow = textSprite('S1 → V(s) → 唤醒 S2 → P(s)', C(p.text2, 0.3));
  sFlow.position.set(SX, -0.8, 0);
  gS.add(sFlow);

  /* =================================================== ③ 代码 gCode */
  const gCode = new THREE.Group();
  host.scene.add(gCode);

  const cardBg = (g, x, y, w, h, col) => {
    const bg = box(w, h, 0.12, p.surface, { edges: true, edgeColor: col, pos: [x, y, 0] });
    g.add(bg);
    return bg;
  };
  const codeRow = (g, text, xLeft, y, color, height = 0.3) => {
    const s = textSprite(text, C(color, height));
    s.position.set(xLeft + s.scale.x / 2, y, 0.12);
    g.add(s);
    return s;
  };

  cardBg(gCode, -3.3, 1.65, 6.0, 4.6, p.warn);
  cardBg(gCode, 3.3, 1.65, 6.0, 4.6, p.memo);
  codeRow(gCode, '互斥：初值 1，P / V 夹住临界区', -6.0, 3.5, p.warn, 0.42);
  codeRow(gCode, 'semaphore mutex = 1;', -6.0, 2.85, p.ok);
  codeRow(gCode, 'P(mutex);  // --mutex，为 0 就阻塞', -6.0, 2.35, p.text2);
  codeRow(gCode, 'critical();  // 临界区', -6.0, 1.85, p.def);
  codeRow(gCode, 'V(mutex);  // ++mutex，唤醒一个', -6.0, 1.35, p.text2);
  codeRow(gCode, '初值必须 1：表示「有 1 个资源」', -6.0, 0.55, p.warn, 0.28);

  codeRow(gCode, '同步：初值 0，V 在前、P 在后', 0.6, 3.5, p.memo, 0.42);
  codeRow(gCode, 'semaphore s = 0;', 0.6, 2.85, p.ok);
  codeRow(gCode, 'S1() { …; V(s); }  // 做完了发信号', 0.6, 2.35, p.text2);
  codeRow(gCode, 'S2() { P(s); …; }  // 等到信号才开工', 0.6, 1.85, p.text2);
  codeRow(gCode, '若把 s 写成 1 → 先后约束失效', 0.6, 1.35, p.err, 0.28);
  codeRow(gCode, '同步量初值 = 0，是被等的「事件」数', 0.6, 0.55, p.memo, 0.28);

  /* =================================================== ④ 易错 gTrap */
  const gTrap = new THREE.Group();
  host.scene.add(gTrap);
  const tTitle = textSprite('常见错误：一个错，整个程序就停在那儿', C(p.err, 0.46));
  tTitle.position.set(0, 4.15, 0);
  gTrap.add(tTitle);

  const trapCard2 = (x, y, title, sub, col) => {
    cardBg(gTrap, x, y, 4.3, 1.6, col);
    const t = textSprite(title, C(col, 0.34));
    t.position.set(x, y + 0.35, 0.12);
    gTrap.add(t);
    const s = textSprite(sub, C(p.text2, 0.27));
    s.position.set(x, y - 0.28, 0.12);
    gTrap.add(s);
  };
  trapCard2(-6.8, 1.95, '① P / V 不成对', '少一个 V → 资源永不释放', p.warn);
  trapCard2(-6.8, 0.2, '③ 用互斥量做同步', '初值写成 1，先后就没有约束', p.key);

  /* ② 两个 P 顺序不一致 → 循环等待 */
  const tPA = box(1.9, 0.6, 1.6, p.def, {
    opacity: 0.6, emissive: p.def, emissiveIntensity: 0.12, pos: [2.6, 0.5, -2.5],
  });
  const tPB = box(1.9, 0.6, 1.6, p.accent, {
    opacity: 0.6, emissive: p.accent, emissiveIntensity: 0.12, pos: [5.6, 0.5, 2.5],
  });
  gTrap.add(tPA, tPB);
  gTrap.add(lbl('A：先 P(a) 后 P(b)', 2.6, 1.05, -2.5, p.text1, 0.28));
  gTrap.add(lbl('B：先 P(b) 后 P(a)', 5.6, 1.05, 2.5, p.text1, 0.28));

  const holdA = box(0.6, 0.34, 0.6, p.ok, { pos: [2.6, 1.55, -2.5] });
  const holdB = box(0.6, 0.34, 0.6, p.ok, { pos: [5.6, 1.55, 2.5] });
  gTrap.add(holdA, holdB);
  gTrap.add(lbl('持有 a 锁', 2.6, 1.95, -2.5, p.ok, 0.26));
  gTrap.add(lbl('持有 b 锁', 5.6, 1.95, 2.5, p.ok, 0.26));

  const cross1 = line([[3.0, 1.5, -2.1], [5.2, 1.5, 2.1]], p.err, { dash: 0.3, gap: 0.18, opacity: 0.9 });
  const cross2 = line([[5.2, 1.5, 2.1], [3.0, 1.5, -2.1]], p.err, { dash: 0.3, gap: 0.18, opacity: 0.9 });
  gTrap.add(cross1, cross2);
  const trapLb = textSprite('互相等对方的锁 → 循环等待 → 死锁', C(p.err, 0.34));
  trapLb.position.set(4.1, 3.0, 0);
  gTrap.add(trapLb);
  const trapHint = textSprite('对策：所有进程按同一顺序 P 资源', C(p.ok, 0.3));
  trapHint.position.set(4.1, -0.6, 0);
  gTrap.add(trapHint);

  /* ==================================================== 模式切换 */
  const NOTES = {
    mx: '互斥量的初值是 1：同一时刻只放一个进程进门，这就是「抢」。',
    sync: '同步量的初值是 0：先做的先 V，后做的才能 P 到，这就是「等」。',
    code: '同一个 P/V，初值 1 是互斥、初值 0 是同步 —— 初值决定了语义。',
    trap: 'P/V 不成对、两个 P 顺序不一致，是考试里最爱出的「死锁」陷阱。',
  };

  const note = textSprite(NOTES.mx, C(p.text2, 0.32));
  note.position.set(0, -1.5, 0);
  host.scene.add(note);

  let cur = 'mx';
  const apply = (key) => {
    cur = key;
    gM.visible = key === 'mx';
    gS.visible = key === 'sync';
    gCode.visible = key === 'code';
    gTrap.visible = key === 'trap';
    retext(note, NOTES[key], C(p.text2, 0.32));
    host.cap(`<b>${
      key === 'mx' ? '互斥（mutex = 1）'
        : key === 'sync' ? '同步（s = 0）'
          : key === 'code' ? '代码对照' : '常见错误'
    }</b> —— ${NOTES[key]}`);
  };

  const btns = host.toolbar([
    { label: '互斥（抢资源）', active: true, onClick: () => { apply('mx'); pick(btns[0]); } },
    { label: '同步（定先后）', onClick: () => { apply('sync'); pick(btns[1]); } },
    { label: '代码对照', onClick: () => { apply('code'); pick(btns[2]); } },
    { label: '常见错误', onClick: () => { apply('trap'); pick(btns[3]); } },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  host.hint('判断一句话：初值 <b>1</b> 是互斥，初值 <b>0</b> 是同步；V 一定在 P 前面那一方才对。');
  apply('mx');

  /* --------------------------------------------------------- 动画 */
  const setBall = (b, x, y, z, col) => {
    b.position.set(x, y, z);
    b.material.color.set(col);
  };

  host.onTick((t) => {
    /* ① 互斥：A 先进，B 等到 A 出来才进 */
    if (gM.visible) {
      const T = 14;
      const u = ((t % T) + T) % T / T;
      const IN = 1.25;
      const OUT = 3.2;
      if (u < 0.06) setBall(mTa, MX, 0.82, -OUT, p.def);
      else if (u < 0.22) setBall(mTa, MX, 0.82, -OUT + (OUT - IN) * ((u - 0.06) / 0.16), p.def);
      else if (u < 0.46) setBall(mTa, MX, 0.82, -IN, p.ok);
      else if (u < 0.62) setBall(mTa, MX, 0.82, -IN - (OUT - IN) * ((u - 0.46) / 0.16), p.def);
      else setBall(mTa, MX, 0.82, -OUT, p.def);

      if (u < 0.62) setBall(mTb, MX, 0.82, OUT + Math.sin(t * 5) * 0.05, p.warn);
      else if (u < 0.76) setBall(mTb, MX, 0.82, OUT - (OUT - IN) * ((u - 0.62) / 0.14), p.accent);
      else if (u < 0.94) setBall(mTb, MX, 0.82, IN, p.ok);
      else setBall(mTb, MX, 0.82, IN + (OUT - IN) * ((u - 0.94) / 0.06), p.accent);

      const heldA = u >= 0.22 && u < 0.46;
      const heldB = u >= 0.76 && u < 0.94;
      mRes.material.emissiveIntensity = heldA || heldB ? 0.55 : 0.1;
      retext(mVal, heldA || heldB ? 'mutex = 0' : 'mutex = 1', C(heldA || heldB ? p.err : p.ok, 0.38));
      retext(mState,
        heldA ? 'A 在临界区：B 的 P 被阻塞，排队等 V'
          : heldB ? 'A 已 V(mutex) → 唤醒 B，B 才得以进入'
            : '空闲：mutex = 1，谁先 P 到谁进',
        C(p.text2, 0.3));
      lbA.material.opacity = 1;
      lbB.material.opacity = 1;
    }

    /* ② 同步：S1 先做，V(s) 后 s=1，S2 才通过 */
    if (gS.visible) {
      const T = 12;
      const u = ((t % T) + T) % T / T;
      const gateX = SX;
      const s1x = SX - 3.15;
      const s2x = SX + 3.15;

      if (u < 0.34) {
        setBall(sTa, s1x + Math.cos(t * 2.4) * 0.55, 1.35, Math.sin(t * 2.4) * 0.55, p.memo);
      } else if (u < 0.42) {
        setBall(sTa, s1x + (gateX - s1x) * 0.65 * ((u - 0.34) / 0.08), 1.35, 0, p.memo);
      } else {
        setBall(sTa, gateX - 0.9, 1.35 + Math.sin(t * 3) * 0.06, 0, p.memo);
      }

      if (u < 0.42) {
        setBall(sTb, gateX - 0.15, 0.95, 0.9 + Math.sin(t * 4) * 0.06, p.err);
      } else if (u < 0.56) {
        setBall(sTb, gateX + (s2x - gateX) * ((u - 0.42) / 0.14), 0.95, 0.9 * (1 - (u - 0.42) / 0.14), p.key);
      } else if (u < 0.9) {
        setBall(sTb, s2x + Math.cos(t * 2.6) * 0.5, 1.35, Math.sin(t * 2.6) * 0.5, p.key);
      } else {
        setBall(sTb, s2x, 1.35, 0, p.key);
      }

      const open = u >= 0.42 && u < 0.9;
      gate.material.opacity = open ? 0.12 : 0.45;
      gate.material.emissiveIntensity = open ? 0.08 : 0.35 + Math.abs(Math.sin(t * 3)) * 0.2;
      retext(gateLb, open ? 'P(s) 通过' : '同步点 P(s)', C(open ? p.ok : p.err, 0.3));
      retext(sVal,
        u < 0.42 ? 's = 0 → S2 阻塞等待'
          : u < 0.56 ? 'S1 执行 V(s) → s = 1 → 唤醒 S2'
            : 'S2 的 P(s) 拿走信号 → s 归 0',
        C(u < 0.42 ? p.warn : p.ok, 0.36));
      sS1.material.emissiveIntensity = u < 0.42 ? 0.45 : 0.1;
      sS2.material.emissiveIntensity = u >= 0.56 ? 0.45 : 0.1;
    }

    /* ④ 易错：循环等待的两条红线在呼吸 */
    if (gTrap.visible) {
      const a = 0.45 + Math.abs(Math.sin(t * 2)) * 0.5;
      cross1.children.forEach((c) => { if (c.material) c.material.opacity = a; });
      cross2.children.forEach((c) => { if (c.material) c.material.opacity = a; });
      holdA.material.emissiveIntensity = 0.3 + Math.abs(Math.sin(t * 2)) * 0.4;
      holdB.material.emissiveIntensity = 0.3 + Math.abs(Math.sin(t * 2 + 1.6)) * 0.4;
    }
  });
}
