/**
 * deadlock-detect.js —— 死锁检测 · 资源分配图化简（2.4.4）
 *
 * 演示「资源分配图」的可化简性判定（死锁定理）：
 *   · 圆圈 = 进程结点，方框 + 小圆点 = 资源结点（圆点个数 = 该资源的实例数）；
 *   · 蓝色箭头 = 分配边 R→P（资源已分给进程），橙色箭头 = 请求边 P→R（进程申请资源）；
 *   · 化简 = 找一个「请求都能被满足」的进程，让它跑完 → 撤销它的请求边与分配边、归还资源；
 *   · 能消掉全部边 ⇒ 可完全化简 ⇒ 无死锁；消不掉的结点就是死锁进程。
 *
 * 两个数据集拓扑完全相同（都含环路 P1→R2→P2→R1→P1），只改变 R1 的实例数：
 *   · 可化简：R1 有 2 个实例 → 环路仍在，却能完全化简 ⇒ 说明「环路只是必要条件」；
 *   · 死锁：  R1 只有 1 个实例 → 环路无法化解 ⇒ 死锁。两者对照最能说明问题。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  box,
  cylinder,
  sphere,
  ring,
  arrow,
  grid,
} from './_runtime.js';

const PNAME = ['P1', 'P2', 'P3'];
const RNAME = ['R1', 'R2', 'R3'];

const PRESETS = {
  reducible: { title: '同构有环 · 但可完全化简 → 无死锁', counts: [2, 1, 1] },
  deadlock: { title: '同构有环 · 不可化简 → 死锁', counts: [1, 1, 1] },
};

// 分配边 R_j → P_i ；请求边 P_i → R_j （下标均从 0 起）
const ASSIGN = [[0, 0], [1, 1], [2, 2]];
const REQ = [[0, 1], [1, 0]];

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0, 5.2, 13.8],
    target: [0, 2.7, 0],
    minDist: 9,
    maxDist: 40,
    maxPolarAngle: Math.PI * 0.49,
    label: 'DEADLOCK DETECTION',
  });
  const p = host.p;
  host.scene.add(grid(30));

  const X = [-3.3, 0, 3.3];
  const PROC_Y = 0.7;
  const PROC_Z = 2.9;
  const RES_Y = 3.0;
  const RES_Z = -2.6;
  const RCOL = [p.def, p.accent2, p.memo]; // R1 / R2 / R3 配色

  const dotOff = (c, k) => (k - (c - 1) / 2) * 0.44;

  /* ------------------------------------------------------------ 请求需求表 */
  const reqNeed = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  REQ.forEach(([i, j]) => (reqNeed[i][j] += 1));

  /* ------------------------------------------------------------- 状态变量 */
  let preset = 'reducible';
  let counts = PRESETS.reducible.counts.slice();
  let held = [0, 0, 0];
  const removed = [false, false, false];
  const seq = [];
  let ended = false;

  /* ------------------------------------------------------- 进程结点（圆圈） */
  const procs = []; // 圆盘材质引用
  const halos = [];
  const fadeProc = []; // 每个进程的淡出记录

  for (let i = 0; i < 3; i++) {
    const grp = new THREE.Group();
    host.scene.add(grp);

    const disc = cylinder(0.8, 0.8, 0.18, p.accent, {
      seg: 44,
      emissive: p.ok,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.2,
    });
    disc.position.set(X[i], PROC_Y, PROC_Z);
    grp.add(disc);
    procs.push(disc);

    const rim = ring(0.8, 0.93, p.line2, { opacity: 0.75 });
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(X[i], PROC_Y + 0.11, PROC_Z);
    grp.add(rim);

    const lab = textSprite(PNAME[i], { color: p.text1, bg: 'rgba(255,255,255,0.9)', border: p.line2, height: 0.56 });
    lab.position.set(X[i], PROC_Y, PROC_Z + 1.05);
    grp.add(lab);

    // 请求边 P_i → R_j（橙色）
    for (const [pi, j] of REQ) {
      if (pi !== i) continue;
      const a = new THREE.Vector3(X[i], PROC_Y + 0.9, PROC_Z);
      const b = new THREE.Vector3(X[j], RES_Y - 0.62, RES_Z);
      const ar = arrow(a, b, p.memo, { opacity: 0.92, headLen: 0.38, headR: 0.13 });
      grp.add(ar);
    }

    // 分配边 R_j → P_i（蓝色，自资源框内的圆点出发）
    for (const [j, pi] of ASSIGN) {
      if (pi !== i) continue;
      const a = new THREE.Vector3(X[j], RES_Y, RES_Z);
      const b = new THREE.Vector3(X[i], PROC_Y + 0.45, PROC_Z);
      const ar = arrow(a, b, p.accent, { opacity: 0.9, headLen: 0.38, headR: 0.13 });
      grp.add(ar);
    }

    fadeProc.push(makeFade(grp));

    const halo = ring(0.98, 1.16, p.ok, { opacity: 0.55 });
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(X[i], PROC_Y - 0.52, PROC_Z);
    halo.visible = false;
    host.scene.add(halo);
    halos.push(halo);
  }

  /** 收集一个对象下的全部材质并记录基准不透明度，返回可供淡出的记录 */
  function makeFade(obj) {
    const mats = [];
    obj.traverse((o) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      ms.forEach((m) => {
        if (m.userData.bop == null) m.userData.bop = m.opacity;
        mats.push(m);
      });
    });
    return { obj, mats, k: 1, t: 1 };
  }

  /* ----------------------------------------------------- 资源结点（方框+圆点） */
  const dots = [[], [], []];
  const resLabels = [];

  for (let j = 0; j < 3; j++) {
    const shell = box(1.72, 1.1, 1.1, p.surface3, {
      edges: true,
      edgeColor: RCOL[j],
      edgeOpacity: 0.55,
      opacity: 0.12,
      roughness: 0.6,
    });
    shell.position.set(X[j], RES_Y, RES_Z);
    host.scene.add(shell);

    const lab = textSprite(`${RNAME[j]}  ×?`, { color: RCOL[j], bg: 'rgba(255,255,255,0.9)', border: p.line2, height: 0.52 });
    lab.position.set(X[j], RES_Y + 0.95, RES_Z);
    host.scene.add(lab);
    resLabels.push(lab);

    for (let k = 0; k < 3; k++) {
      const d = sphere(0.17, p.ok, { seg: 18, roughness: 0.35, emissive: p.ok, emissiveIntensity: 0.4 });
      d.position.set(X[j], RES_Y, RES_Z);
      host.scene.add(d);
      dots[j].push(d);
    }
  }

  /* ------------------------------------------------------------- HUD */
  const titleLab = textSprite(PRESETS.reducible.title, { color: p.accent, height: 0.46 });
  titleLab.position.set(0, 6.6, -1.0);
  host.scene.add(titleLab);

  const availSprites = [];
  for (let j = 0; j < 3; j++) {
    const s = textSprite(`${RNAME[j]}  可用 0 / 0`, { color: RCOL[j], bg: 'rgba(255,255,255,0.92)', border: p.line2, height: 0.56 });
    s.position.set((j - 1) * 2.6, 5.85, -1.0);
    host.scene.add(s);
    availSprites.push(s);
  }

  const seqLab = textSprite('已消去：（尚未开始）', { color: p.text2, bg: 'rgba(255,255,255,0.9)', border: p.line2, height: 0.5 });
  seqLab.position.set(0, 5.15, -1.0);
  host.scene.add(seqLab);

  /* ------------------------------------------------------------- 工具 */
  const retext = (sprite, text, opts) => {
    const next = textSprite(text, opts);
    sprite.material.map.dispose();
    sprite.material.map = next.material.map;
    sprite.material.needsUpdate = true;
    sprite.scale.set(next.scale.x, next.scale.y, 1);
    next.material.dispose();
  };

  const avail = (j) => counts[j] - held[j];
  const satisfiable = (i) => {
    for (let j = 0; j < 3; j++) if (reqNeed[i][j] > avail(j)) return false;
    return true;
  };
  const reqList = (i) => {
    const parts = [];
    for (let j = 0; j < 3; j++) for (let k = 0; k < reqNeed[i][j]; k++) parts.push(RNAME[j]);
    return parts;
  };

  const render = () => {
    retext(titleLab, PRESETS[preset].title, { color: p.accent, height: 0.46 });

    for (let j = 0; j < 3; j++) {
      retext(resLabels[j], `${RNAME[j]}  ×${counts[j]}`, { color: RCOL[j], bg: 'rgba(255,255,255,0.9)', border: p.line2, height: 0.52 });
      retext(availSprites[j], `${RNAME[j]}  可用 ${avail(j)} / ${counts[j]}`, { color: RCOL[j], bg: 'rgba(255,255,255,0.92)', border: p.line2, height: 0.56 });

      dots[j].forEach((d, k) => {
        const on = k < counts[j];
        d.visible = on;
        d.position.set(X[j] + dotOff(counts[j], k), RES_Y, RES_Z);
        const isHeld = k < held[j];
        const col = isHeld ? p.text3 : p.ok;
        d.material.color.set(col);
        d.material.emissive.set(col);
        d.material.emissiveIntensity = isHeld ? 0.05 : 0.45;
      });
    }

    for (let i = 0; i < 3; i++) {
      if (removed[i]) {
        halos[i].visible = false;
        continue;
      }
      const ok = satisfiable(i);
      halos[i].visible = ok && !ended;
      procs[i].material.emissive.set(ok ? p.ok : p.err);
      procs[i].material.emissiveIntensity = ok ? 0.34 : 0.26;
    }

    retext(
      seqLab,
      seq.length ? '已消去：' + seq.map((i) => PNAME[i]).join(' → ') : '已消去：（尚未开始）',
      { color: p.text2, bg: 'rgba(255,255,255,0.9)', border: p.line2, height: 0.5 }
    );
  };

  const pulse = (btn) => btn && btn.animate && btn.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 260 });

  /* ------------------------------------------------------------- 重置 */
  const reset = () => {
    counts = PRESETS[preset].counts.slice();
    held = [0, 0, 0];
    ASSIGN.forEach(([j]) => (held[j] += 1));
    for (let i = 0; i < 3; i++) removed[i] = false;
    seq.length = 0;
    ended = false;
    fadeProc.forEach((f) => {
      f.k = 1;
      f.t = 1;
      f.obj.visible = true;
      f.mats.forEach((m) => {
        m.opacity = m.userData.bop;
      });
    });
    render();
    host.hint(
      '圆圈 = 进程，方框 + 小圆点 = 资源（点数 = 实例数）。' +
        '<b style="color:var(--sem-def)">蓝箭头</b> = 分配边 R→P，' +
        '<b style="color:var(--sem-key)">橙箭头</b> = 请求边 P→R。' +
        '化简：找一个请求都能被满足的进程，让它跑完并归还资源。'
    );
    host.cap(
      `<b>初始</b>：可用实例 = (${avail(0)}, ${avail(1)}, ${avail(2)})。` +
        `绿色光环保留标记「当前可以被满足」的进程，<b>点击「化简一步」</b> 逐次消去进程结点。`
    );
  };

  /* ------------------------------------------------------------- 单步化简 */
  const step = (btn) => {
    if (ended) {
      host.cap('演示已结束，点击 <b>重置</b> 或切换数据后再试。');
      return;
    }
    const cands = [];
    for (let i = 0; i < 3; i++) if (!removed[i] && satisfiable(i)) cands.push(i);

    if (cands.length === 0) {
      ended = true;
      render();
      const rest = [0, 1, 2].filter((i) => !removed[i]);
      host.cap(
        `<b>无法继续化简</b>：剩余进程 ${rest.map((i) => PNAME[i]).join('、')} 的请求都得不到满足，` +
          `资源分配图<b style="color:var(--sem-warn)">不可完全化简</b> → 系统处于<b style="color:var(--sem-warn)">死锁</b>，` +
          `死锁进程即 ${rest.map((i) => PNAME[i]).join('、')}。`
      );
      return;
    }

    const i = cands[0]; // 约定：每一步选下标最小者
    removed[i] = true;
    seq.push(i);
    fadeProc[i].t = 0;

    const freed = [];
    ASSIGN.forEach(([j, pi]) => {
      if (pi === i) {
        held[j] -= 1;
        freed.push(RNAME[j]);
      }
    });
    render();

    const rq = reqList(i);
    if (rq.length) {
      host.cap(
        `<b>第 ${seq.length} 步</b>：${PNAME[i]} 的请求边 ${rq.join('、')} ≤ 可用实例 ✓ → ` +
          `${PNAME[i]} 运行完成，撤销其请求边与分配边，归还 ${freed.length ? freed.join('、') : '（无）'}。`
      );
    } else {
      host.cap(
        `<b>第 ${seq.length} 步</b>：${PNAME[i]} 不请求任何资源 → 直接运行完成，` +
          `撤销其分配边，归还 ${freed.length ? freed.join('、') : '（无）'}。`
      );
    }
    pulse(btn);

    if (removed.every(Boolean)) {
      ended = true;
      render();
      host.cap(
        `<b>化简完成</b>：所有进程结点与边都能消去 → 资源分配图<b style="color:var(--ok)">可完全化简</b> → ` +
          `系统<b style="color:var(--ok)">无死锁</b>。注意图中明明有环路 ${PNAME[0]}→R2→${PNAME[1]}→R1→${PNAME[0]}，` +
          `却并不是死锁 —— <b>环路只是死锁的必要条件</b>。`
      );
    }
  };

  /* ------------------------------------------------------------- 交互 */
  const btns = host.toolbar([
    { label: '化简一步（去除一个可完成进程）', onClick: (b) => step(b) },
    {
      label: '切换数据：死锁',
      onClick: (b) => {
        preset = preset === 'reducible' ? 'deadlock' : 'reducible';
        b.textContent = preset === 'reducible' ? '切换数据：死锁' : '切换数据：可化简';
        reset();
        host.cap(
          preset === 'reducible'
            ? '已切换到<b>可化简</b>数据（R1 有 2 个实例）：同样的环路，却能完全化简 → 无死锁。'
            : '已切换到<b>死锁</b>数据（R1 只剩 1 个实例）：同样的环路，却化简不下去 → 死锁。'
        );
      },
    },
    { label: '重置', onClick: () => reset() },
  ]);
  void btns;

  reset();

  /* ------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    const k = Math.min(1, dt * 5);
    fadeProc.forEach((f) => {
      f.k += (f.t - f.k) * k;
      f.obj.visible = f.k > 0.01;
      f.mats.forEach((m) => {
        m.transparent = true;
        m.opacity = m.userData.bop * f.k;
      });
    });
    halos.forEach((h, i) => {
      if (h.visible) h.material.opacity = 0.4 + Math.sin(t * 3.4 + i) * 0.22;
    });
    dots.forEach((arr) =>
      arr.forEach((d, k2) => {
        if (!d.visible) return;
        d.scale.setScalar(1 + Math.sin(t * 2.2 + k2) * 0.04);
      })
    );
  });
}
