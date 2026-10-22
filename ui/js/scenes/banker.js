/**
 * banker.js —— 银行家算法 · 安全性检查（2.4.3）
 *
 * 演示教材经典例题（5 进程 P0~P4、3 类资源 A/B/C）的安全性算法：
 *   · 每个进程用三根彩色立方柱表示 Need(A B C)，柱色区分资源类型；
 *   · Work 向量从 Available 出发，凡 Need[i] ≤ Work 的进程即可「跑完并归还 Allocation」；
 *   · 每步按「最小下标优先」挑选，Work 随之增长，最终形成安全序列 [1,3,0,2,4]；
 *   · 另附一组不安全数据，演示「找不到安全序列 → 不安全状态」。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  box,
  ring,
  grid,
} from './_runtime.js';

const CAP = [10, 5, 7]; // A/B/C 三类资源的刻度上限（仅用于摆放）
const PROCS = [
  { need: [7, 4, 3], alloc: [0, 1, 0] }, // P0
  { need: [1, 2, 2], alloc: [2, 0, 0] }, // P1
  { need: [6, 0, 0], alloc: [3, 0, 2] }, // P2
  { need: [0, 1, 1], alloc: [2, 1, 1] }, // P3
  { need: [4, 3, 1], alloc: [0, 0, 2] }, // P4
];

const PRESETS = {
  safe: { title: '例题 · Available = (3,3,2)', avail: [3, 3, 2], safe: true },
  unsafe: { title: '变式 · Available = (1,1,1)', avail: [1, 1, 1], safe: false },
};

const fmt = (v) => '(' + v.join(',') + ')';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0, 9.2, 16.2],
    target: [0, 1.9, -0.4],
    minDist: 11,
    maxDist: 46,
    maxPolarAngle: Math.PI * 0.49,
    label: "BANKER'S ALGORITHM",
  });
  const p = host.p;
  host.scene.add(grid(30));

  const RCOL = [p.def, p.accent2, p.memo]; // A / B / C 三类资源配色
  const RNAME = ['A', 'B', 'C'];
  const groupX = (i) => (i - 2) * 2.62;
  const colX = (j) => (j - 1) * 0.72;
  const CUBE = 0.34;
  const Y0 = 0.36;
  const YSTEP = 0.4;

  /* -------------------------------------------------------- 进程柱状组 */
  const groups = [];
  for (let i = 0; i < 5; i++) {
    const grp = new THREE.Group();
    grp.position.set(groupX(i), 0, 0);
    host.scene.add(grp);

    const plate = box(2.1, 0.1, 1.6, p.surface3, { edges: false, edgeColor: p.line2, opacity: 1 });
    plate.position.set(0, 0.05, 0);
    grp.add(plate);

    const nameLab = textSprite(`P${i}`, { color: p.text1, bg: 'rgba(255,255,255,0.9)', border: p.line2, height: 0.5 });
    nameLab.position.set(0, 0.5, 0.98);
    grp.add(nameLab);

    for (let j = 0; j < 3; j++) {
      const n = PROCS[i].need[j];
      for (let k = 0; k < n; k++) {
        const c = box(CUBE, CUBE, CUBE, RCOL[j], {
          edges: true,
          edgeColor: p.bg0,
          edgeOpacity: 0.35,
          opacity: 1,
          roughness: 0.42,
          emissive: RCOL[j],
          emissiveIntensity: 0.22,
        });
        c.position.set(colX(j), Y0 + k * YSTEP, 0);
        grp.add(c);
      }
    }

    const needLab = textSprite(`Need ${fmt(PROCS[i].need)}`, { color: p.text3, height: 0.38 });
    needLab.position.set(0, 1.0, -0.98);
    grp.add(needLab);

    const halo = ring(1.0, 1.16, p.ok, { opacity: 0.55 });
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(0, 0.12, 0);
    halo.visible = false;
    grp.add(halo);

    groups.push({ grp, halo, alpha: 1, targetAlpha: 1, lift: 0, targetLift: 0 });
  }

  /* ------------------------------------------------------------ 资源图例 */
  for (let j = 0; j < 3; j++) {
    const lab = textSprite(`资源 ${RNAME[j]}`, { color: RCOL[j], height: 0.42 });
    lab.position.set(groupX(0) + colX(j), 0.16, 1.6);
    host.scene.add(lab);
  }

  /* ------------------------------------------------------- Work 向量 HUD */
  const hudTitle = textSprite('Work （试探性工作向量）', { color: p.text2, height: 0.48 });
  hudTitle.position.set(0, 4.85, -0.6);
  host.scene.add(hudTitle);

  const workSprites = [];
  for (let j = 0; j < 3; j++) {
    const s = textSprite(`${RNAME[j]} = 0`, { color: p.bg0, bg: RCOL[j], height: 0.62 });
    s.position.set((j - 1) * 1.9, 4.25, -0.6);
    host.scene.add(s);
    workSprites.push(s);
  }

  const seqLab = textSprite('安全序列：—', { color: p.text2, bg: 'rgba(255,255,255,0.9)', border: p.line2, height: 0.5 });
  seqLab.position.set(0, 3.42, -0.6);
  host.scene.add(seqLab);

  const titleLab = textSprite(PRESETS.safe.title, { color: p.accent, height: 0.46 });
  titleLab.position.set(0, 5.5, -0.6);
  host.scene.add(titleLab);

  /* --------------------------------------------------------------- 状态 */
  let preset = 'safe';
  let work = PRESETS.safe.avail.slice();
  const fin = [false, false, false, false, false];
  const seq = [];
  let ended = false;

  const retext = (sprite, text, opts) => {
    const next = textSprite(text, opts);
    sprite.material.map.dispose();
    sprite.material.map = next.material.map;
    sprite.material.needsUpdate = true;
    sprite.scale.set(next.scale.x, next.scale.y, 1);
    next.material.dispose();
  };

  const fits = (i) => PROCS[i].need.every((n, j) => n <= work[j]);

  const renderWork = () => {
    for (let j = 0; j < 3; j++) {
      retext(workSprites[j], `${RNAME[j]} = ${work[j]}`, { color: p.bg0, bg: RCOL[j], height: 0.62 });
    }
  };

  const renderSeq = () => {
    retext(
      seqLab,
      seq.length ? '已完成：' + seq.map((i) => `P${i}`).join(' → ') : '安全序列：（尚未开始）',
      { color: p.text2, bg: 'rgba(255,255,255,0.9)', border: p.line2, height: 0.5 }
    );
    groups.forEach((g, i) => {
      const waiting = !fin[i] && fits(i);
      g.halo.visible = waiting && !ended;
    });
  };

  const setGroupState = () => {
    groups.forEach((g, i) => {
      g.targetAlpha = fin[i] ? 0.12 : 1;
      g.targetLift = fin[i] ? 1.35 : 0;
    });
  };

  /* -------------------------------------------------------------- 单步 */
  const step = (btn) => {
    if (ended) {
      host.cap('演示已结束，点击 <b>重置</b> 或切换数据后再试。');
      return;
    }
    const cands = [];
    for (let i = 0; i < 5; i++) if (!fin[i] && fits(i)) cands.push(i);
    if (cands.length === 0) {
      ended = true;
      renderSeq();
      const allDone = fin.every(Boolean);
      if (allDone) {
        host.cap(
          `<b>安全性检查结束</b>：所有进程都能完成 → 系统处于<b style="color:var(--ok)">安全状态</b>，` +
            `安全序列 = ${seq.map((i) => `P${i}`).join(' → ')}。`
        );
      } else {
        const rest = PROCS.map((_, i) => i).filter((i) => !fin[i]);
        host.cap(
          `<b>安全性检查结束</b>：Work = ${fmt(work)}，剩余进程 ${rest.map((i) => `P${i}`).join('、')} 的 Need 都大于 Work → ` +
            `找不到完整安全序列 → 系统处于<b style="color:var(--sem-warn)">不安全状态</b>（不安全 ≠ 必然死锁，但可能死锁）。`
        );
      }
      return;
    }
    const i = cands[0]; // 约定：每一步选下标最小者
    fin[i] = true;
    seq.push(i);
    const before = work.slice();
    for (let j = 0; j < 3; j++) work[j] += PROCS[i].alloc[j];
    renderWork();
    renderSeq();
    setGroupState();
    host.cap(
      `<b>第 ${seq.length} 步</b>：Need(P${i}) = ${fmt(PROCS[i].need)} ≤ Work = ${fmt(before)} ✓ → ` +
        `P${i} 可完成，归还 Allocation = ${fmt(PROCS[i].alloc)} → <b>Work = ${fmt(work)}</b>。`
    );
    pulse(btn);
  };

  const pulse = (btn) => btn && btn.animate && btn.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 260 });

  /* -------------------------------------------------------------- 重置 */
  const reset = () => {
    work = PRESETS[preset].avail.slice();
    for (let i = 0; i < 5; i++) fin[i] = false;
    seq.length = 0;
    ended = false;
    groups.forEach((g) => {
      g.targetAlpha = 1;
      g.targetLift = 0;
      g.halo.visible = false;
    });
    retext(titleLab, PRESETS[preset].title, { color: p.accent, height: 0.46 });
    renderWork();
    renderSeq();
    host.hint(
      '安全性算法：<b>比 Need、给 Work、标 Finish</b> —— 找 Need ≤ Work 的进程，让它跑完并把它的 Allocation 加回 Work。'
    );
    host.cap(
      `<b>初始</b>：Available = Work = ${fmt(work)}。<i>高亮（绿环）标记当前 Need ≤ Work、可以被满足的进程。</i> 点击 <b>下一步</b> 逐行推进。`
    );
  };

  /* -------------------------------------------------------------- 交互 */
  const btns = host.toolbar([
    { label: '下一步（执行一次安全性检查）', onClick: (b) => step(b) },
    {
      label: '切换数据：不安全',
      onClick: (b) => {
        preset = preset === 'safe' ? 'unsafe' : 'safe';
        b.textContent = preset === 'safe' ? '切换数据：不安全' : '切换数据：安全例题';
        reset();
        host.cap(
          preset === 'safe'
            ? '已切换到<b>教材例题</b>（Available = (3,3,2)），可求得安全序列 [1,3,0,2,4]。'
            : '已切换到<b>不安全变式</b>（Available = (1,1,1)），观察它何时「卡住」找不到安全序列。'
        );
      },
    },
    { label: '重置', onClick: () => reset() },
  ]);
  void btns;

  reset();

  /* -------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    const k = Math.min(1, dt * 5);
    groups.forEach((g, i) => {
      g.alpha += (g.targetAlpha - g.alpha) * k;
      g.lift += (g.targetLift - g.lift) * k;
      g.grp.position.y = g.lift;
      g.grp.traverse((o) => {
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => {
          if (m.userData.baseOpacity == null) m.userData.baseOpacity = m.opacity;
          m.transparent = true;
          m.opacity = m.userData.baseOpacity * g.alpha;
        });
      });
      if (g.halo.visible) {
        g.halo.material.opacity = 0.4 + Math.sin(t * 3.4 + i) * 0.22;
      }
    });
  });
}
