/**
 * mutex-impl.js —— 实现临界区互斥的基本方法（2.3.2）
 *
 * 三块面板并排同时演示软件方案的「毛病」，判分时一眼就能看出谁不满足哪条准则：
 *   ① 单标志法（turn）：强制轮换 → 违背「空闲让进」
 *   ② 双标志法·后检查：互相谦让 → 两个都进不去（饥饿）
 *   ③ Peterson：flag + turn 双保险 → 正确（但仍是忙等）
 * 第四个模式换成硬件方案：关中断 / TestAndSet / Swap。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  retext,
  box,
  sphere,
  grid,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [1.6, 9.2, 15.8],
    target: [0, 1.4, 0],
    minDist: 12,
    maxDist: 42,
    maxPolarAngle: Math.PI * 0.48,
    label: '临界区互斥的软件与硬件实现',
  });
  const p = host.p;
  host.scene.add(grid(34));

  const ZG = 2.55;   // 门外
  const ZIN = 1.10;  // 门内（临界区）

  const PANELS = [
    { key: 'one', x: -7.4, title: '① 单标志法 turn', v: 'turn = 0 / 1', c: p.warn },
    { key: 'two', x: 0, title: '② 双标志（后检查）', v: 'flag[0]=flag[1]=1', c: p.err },
    { key: 'pet', x: 7.4, title: '③ Peterson 算法', v: 'flag + turn', c: p.ok },
  ];

  const panels = [];

  PANELS.forEach((cfg) => {
    const { x } = cfg;
    const cs = box(2.9, 0.5, 1.9, p.def, {
      opacity: 0.62, emissive: p.def, emissiveIntensity: 0.12, pos: [x, 0.55, 0],
    });
    host.scene.add(cs);
    const csLb = textSprite('临界区', { color: p.text1, height: 0.32 });
    csLb.position.set(x, 0.98, 0);
    host.scene.add(csLb);

    const mk = (z, tag, col) => {
      const b = box(2.4, 0.4, 1.3, col, {
        opacity: 0.62, emissive: col, emissiveIntensity: 0.1, pos: [x, 0.5, z],
      });
      host.scene.add(b);
      const lb = textSprite(tag, { color: p.text2, height: 0.3 });
      lb.position.set(x, 0.82, z + (z < 0 ? -0.5 : 0.5));
      host.scene.add(lb);
      return b;
    };
    const ga = mk(-3.4, '进程 A', p.def);
    const gb = mk(3.4, '进程 B', p.accent);

    const ta = sphere(0.23, p.def, { emissive: p.def, emissiveIntensity: 0.9 });
    const tb = sphere(0.23, p.accent, { emissive: p.accent, emissiveIntensity: 0.9 });
    host.scene.add(ta, tb);

    const varLb = textSprite(cfg.v, { color: cfg.c, height: 0.3 });
    varLb.position.set(x, 1.62, 0);
    host.scene.add(varLb);

    const titleLb = textSprite(cfg.title, { color: cfg.c, height: 0.42 });
    titleLb.position.set(x, 4.3, 0);
    host.scene.add(titleLb);

    const verdict = textSprite('待演示', { color: cfg.c, height: 0.32 });
    verdict.position.set(x, -0.55, 0);
    host.scene.add(verdict);

    panels.push({ cfg, cs, csLb, ga, gb, ta, tb, varLb, titleLb, verdict });
  });

  /* ------------------------------------------------------ 硬件方案卡片 */
  const HW = [
    ['关中断', '进入临界区前关中断、退出后开中断', '单核有效；多核无效；用户态无权执行'],
    ['TestAndSet', '硬件原子地读旧值并置 true（TSL 指令）', '多核有效；不满足让权等待，仍忙等'],
    ['Swap / XCHG', '原子交换寄存器与锁变量（XCHG 指令）', '与 TSL 等价，同样忙等'],
  ];
  const gHw = new THREE.Group();
  host.scene.add(gHw);
  HW.forEach((h, i) => {
    const x = -6.6 + i * 6.6;
    const b = box(5.6, 1.5, 2.2, p.key, {
      opacity: 0.28, emissive: p.key, emissiveIntensity: 0.1, pos: [x, 1.4, 0],
    });
    gHw.add(b);
    const t1 = textSprite(h[0], { color: p.text1, height: 0.42 });
    t1.position.set(x, 2.5, 0);
    gHw.add(t1);
    const t2 = textSprite(h[1], { color: p.text2, height: 0.28 });
    t2.position.set(x, 1.45, 0);
    gHw.add(t2);
    const t3 = textSprite(h[2], { color: p.warn, height: 0.26 });
    t3.position.set(x, 0.85, 0);
    gHw.add(t3);
  });

  /* ------------------------------------------------------------ 交互 */
  const NOTES = {
    all: '三块面板同时跑：看谁卡住了、为什么卡。软件方案的通病是「忙等」或「不满足某条准则」。',
    one: '单标志法：用 turn 强制交替。A 出临界区后把 turn 交给 B，即使 B 根本不想进，A 也不能再进 —— 违背「空闲让进」。',
    two: '双标志法（后检查）：先置自己的 flag 再检查对方，结果双方都谦让、都进不去 —— 违背「空闲让进」，会饥饿。',
    pet: 'Peterson：flag 表明意愿、turn 谦让一次。三条准则都满足（互斥、空闲让进、有限等待），但仍是忙等，不满足让权等待。',
    hw: '硬件方法：关中断只在单核有效且用户态无权；TSL / Swap 靠一条原子指令完成「读+写」，多核可用，但同样忙等。',
  };

  let cur = 'all';
  const note = textSprite(NOTES.all, { color: p.text2, height: 0.32 });
  note.position.set(0, -1.35, 0);
  host.scene.add(note);

  const apply = (key) => {
    cur = key;
    gHw.visible = key === 'hw';
    panels.forEach((P) => {
      const on = key === 'all' || key === P.cfg.key;
      P.cs.material.opacity = on ? 0.62 : 0.18;
      P.ga.material.opacity = on ? 0.62 : 0.16;
      P.gb.material.opacity = on ? 0.62 : 0.16;
      P.ta.visible = P.tb.visible = on;
      P.varLb.material.opacity = on ? 1 : 0.28;
      P.titleLb.material.opacity = on ? 1 : 0.3;
      P.verdict.visible = on;
      P.csLb.material.opacity = on ? 1 : 0.25;
    });
    retext(note, NOTES[key], { color: p.text2, height: 0.32 });
    host.cap(`<b>${
      key === 'all' ? '三种软件方案' : key === 'one' ? '单标志法' : key === 'two' ? '双标志法（后检查）' : key === 'pet' ? 'Peterson 算法' : '硬件方法'
    }</b> —— ${NOTES[key]}`);
  };

  const btns = host.toolbar([
    { label: '三种同台', active: true, onClick: () => { apply('all'); pick(btns[0]); } },
    { label: '单标志法', onClick: () => { apply('one'); pick(btns[1]); } },
    { label: '双标志（后检查）', onClick: () => { apply('two'); pick(btns[2]); } },
    { label: 'Peterson', onClick: () => { apply('pet'); pick(btns[3]); } },
    { label: '硬件方法', onClick: () => { apply('hw'); pick(btns[4]); } },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  host.hint('考试常问「Peterson 为什么不满足让权等待」——因为它一直用 while 死循环检查 flag。');
  apply('all');

  /* ------------------------------------------------------------ 动画 */
  const setA = (tg, z, col) => {
    tg.position.set(tg.position.x, 0.82, z);
    tg.material.color.set(col);
  };

  host.onTick((t) => {
    panels.forEach((P) => {
      const x = P.cfg.x;
      P.ta.position.x = x;
      P.tb.position.x = x;

      if (P.cfg.key === 'one') {
        // A 进去 3 秒，出来后想再进 → 被 turn 顶回来（B 却从不进）
        const u = (t / 9) % 1;
        if (u < 0.1) setA(P.ta, -ZG, p.def);
        else if (u < 0.25) setA(P.ta, -ZG + (ZG - ZIN) * ((u - 0.1) / 0.15), p.def);
        else if (u < 0.55) setA(P.ta, -ZIN, p.ok);
        else if (u < 0.7) setA(P.ta, -ZIN - (ZG - ZIN) * ((u - 0.55) / 0.15), p.def);
        else if (u < 0.8) setA(P.ta, -ZG, p.err);            // 想再进，turn=1，被拒
        else setA(P.ta, -ZG - Math.sin(t * 12) * 0.02, p.err);
        setA(P.tb, ZG + Math.sin(t * 1.6) * 0.04, p.text3);   // B 一直不想进
        P.cs.material.emissiveIntensity = u > 0.25 && u < 0.55 ? 0.5 : 0.1;
        retext(P.verdict, u > 0.7 ? '✗ 违背「空闲让进」' : 'A 进入临界区', { color: u > 0.7 ? p.err : p.ok, height: 0.32 });
      }

      if (P.cfg.key === 'two') {
        // 双方同时置 flag 再检查 → 都以为对方要进 → 都卡在门外
        const jit = Math.sin(t * 9) * 0.09;
        setA(P.ta, -ZG + jit, p.err);
        setA(P.tb, ZG - jit, p.err);
        P.cs.material.emissiveIntensity = 0.06;
        retext(P.verdict, '✗ 互相谦让 · 都进不去', { color: p.err, height: 0.32 });
      }

      if (P.cfg.key === 'pet') {
        const u = (t / 11) % 1;
        // A: 0.05~0.42 在临界区；B: 0.52~0.9
        if (u < 0.05) setA(P.ta, -ZG, p.def);
        else if (u < 0.16) setA(P.ta, -ZG + (ZG - ZIN) * ((u - 0.05) / 0.11), p.def);
        else if (u < 0.34) setA(P.ta, -ZIN, p.ok);
        else if (u < 0.45) setA(P.ta, -ZIN - (ZG - ZIN) * ((u - 0.34) / 0.11), p.def);
        else setA(P.ta, -ZG, p.def);
        if (u < 0.45) setA(P.tb, ZG, p.text3);
        else if (u < 0.56) setA(P.tb, ZG - (ZG - ZIN) * ((u - 0.45) / 0.11), p.accent);
        else if (u < 0.8) setA(P.tb, ZIN, p.ok);
        else if (u < 0.9) setA(P.tb, ZIN + (ZG - ZIN) * ((u - 0.8) / 0.1), p.accent);
        else setA(P.tb, ZG, p.accent);
        const inA = u >= 0.16 && u < 0.34;
        const inB = u >= 0.56 && u < 0.8;
        P.cs.material.emissiveIntensity = inA || inB ? 0.55 : 0.1;
        retext(P.verdict, inA ? 'A 在临界区，B 忙等' : inB ? 'B 在临界区，A 忙等' : '✓ 互斥成立', {
          color: p.ok, height: 0.32,
        });
      }
    });
    if (cur === 'hw') {
      gHw.children.forEach((c, i) => {
        if (c.geometry && c.geometry.type === 'BoxGeometry') {
          c.material.emissiveIntensity = 0.08 + Math.abs(Math.sin(t * 1.2 + i)) * 0.18;
        }
      });
    }
  });
}
