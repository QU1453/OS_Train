/**
 * os-structure.js —— 操作系统的结构（1.4）
 *
 * 同一组「OS 功能模块」在五种结构下重新排布，直观对比：
 *   分层结构 / 模块化结构 / 宏内核 / 微内核 / 外核
 * 内核壳体（shell）会随结构一起变形：大内核 → 小内核 → 只剩一层薄板。
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
} from './_runtime.js';

const N = 6;

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [9.5, 8.2, 14.5],
    target: [0, 2.4, 0],
    minDist: 9,
    maxDist: 42,
    maxPolarAngle: Math.PI * 0.49,
    label: 'OS 的五种结构',
  });
  const p = host.p;
  host.scene.add(grid(28));

  const COLORS = [p.memo, p.accent, p.def, p.accent2, p.key, p.exam];
  const NAMES = ['中断处理', '进程管理', '内存管理', '设备管理', '文件管理', '系统调用接口'];

  /* ------------------------------------------------------------ 硬件 / 应用 */
  const hw = box(11.6, 0.44, 8.2, p.surface3, { roughness: 0.8 });
  hw.position.set(0, 0.22, 0);
  host.scene.add(hw);
  const hwLb = textSprite('硬件', { color: p.text2, height: 0.42 });
  hwLb.position.set(0, 0.22, 4.9);
  host.scene.add(hwLb);

  const app = box(9.4, 0.34, 5.6, p.surface, { opacity: 0.95 });
  app.position.set(0, 5.35, 0);
  host.scene.add(app);
  const appLb = textSprite('用户态 · 应用程序', { color: p.text1, height: 0.44 });
  appLb.position.set(0, 5.35, 3.2);
  host.scene.add(appLb);

  /* ---------------------------------------------------------------- 内核壳 */
  const shell = box(1, 1, 1, p.def, {
    opacity: 0.13,
    edges: true,
    edgeOpacity: 0.55,
    edgeColor: 0x2b3a4a,
    roughness: 0.4,
  });
  shell.position.set(0, 2.4, 0);
  host.scene.add(shell);
  const shellWant = {
    pos: new THREE.Vector3(0, 2.4, 0),
    scale: new THREE.Vector3(8.0, 4.1, 5.6),
  };
  const shellAt = (sx, sy, sz, py) => {
    shellWant.scale.set(sx, sy, sz);
    shellWant.pos.set(0, py, 0);
  };
  const shellLb = textSprite('内核', { color: p.def, height: 0.46 });
  shellLb.position.set(0, 2.4, 0);
  host.scene.add(shellLb);

  /* -------------------------------------------------------------- 功能模块 */
  const svcs = [];
  for (let i = 0; i < N; i++) {
    const m = box(1, 1, 1, COLORS[i], {
      emissive: COLORS[i],
      emissiveIntensity: 0.26,
      roughness: 0.42,
    });
    m.position.set(0, 2.4, 0);
    host.scene.add(m);
    const lb = textSprite(NAMES[i], { color: p.text2, height: 0.36 });
    lb.position.set(0, 2.4, 0);
    host.scene.add(lb);
    svcs.push({
      mesh: m,
      label: lb,
      wantP: new THREE.Vector3(0, 2.4, 0),
      wantS: new THREE.Vector3(1.4, 0.9, 1.4),
      wantL: new THREE.Vector3(0, 3.0, 0),
    });
  }

  /* ------------------------------------------------- 微内核：消息传递小球 */
  const msgs = [0, 1].map(() => {
    const s = sphere(0.2, p.exam, { emissive: p.exam, emissiveIntensity: 0.9 });
    s.visible = false;
    host.scene.add(s);
    return s;
  });

  /* ----------------------------------------------------- 外核：授权箭头 */
  const grants = [];
  for (let i = 0; i < N; i++) {
    const a = arrow(new THREE.Vector3(0, 3.0, 0), new THREE.Vector3(0, 1.0, 0), p.ok, {
      headR: 0.1,
      opacity: 0.7,
    });
    a.visible = false;
    host.scene.add(a);
    grants.push(a);
  }

  /* ------------------------------------------------------------ 模块连线 */
  // 注意：arrow() 在起终点相同时会返回空 Group（0 children），
  // 所以这里给一个「占位但非零」的终点，真正的端点每帧由 onTick 重写。
  const links = [];
  for (let i = 0; i < N; i++) {
    const a = arrow(new THREE.Vector3(0, 2.2, 0), new THREE.Vector3(1.2, 2.2, 0), p.line2, {
      headR: 0.08,
      opacity: 0.45,
    });
    a.visible = false;
    host.scene.add(a);
    links.push(a);
  }

  /* --------------------------------------------------------------- 状态 */
  let mode = 'layered';
  let phase = 0;

  const setSvc = (i, x, y, z, sx, sy, sz, lx, ly, lz) => {
    const s = svcs[i];
    s.wantP.set(x, y, z);
    s.wantS.set(sx, sy, sz);
    s.wantL.set(lx, ly, lz);
  };

  const MODES = {
    layered: {
      cap:
        '<b>分层结构</b>：自底向上逐层抽象，每层<b>只能调用相邻下层</b>。好调试、易验证，但层间穿透开销大、效率低。',
      hint: '典型：<b>分层结构</b> = 模块间单向依赖；缺点 <b>效率低</b>（请求要一层层往下传）。',
      apply() {
        shellAt(8.0, 4.1, 5.6, 2.55);
        shell.material.opacity = 0.1;
        shellLb.visible = true;
        shellLb.position.set(-4.6, 4.42, 0);
        for (let i = 0; i < N; i++) {
          const y = 0.82 + i * 0.68;
          setSvc(i, 0, y, 0, 7.3, 0.46, 5.0, 4.35, y, 0);
        }
      },
    },
    modular: {
      cap:
        '<b>模块化结构</b>：按功能划分模块，模块之间<b>可任意调用</b>，通过接口约定交互。灵活、易扩充，但接口定义难、整体性差。',
      hint: '典型：<b>模块化</b> = 任意模块可互相调用；难点是<b>接口设计</b>。',
      apply() {
        shellAt(7.4, 3.0, 6.8, 2.3);
        shell.material.opacity = 0.09;
        shellLb.visible = true;
        shellLb.position.set(-4.3, 3.9, 0);
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(a) * 2.55;
          const z = Math.sin(a) * 2.15;
          setSvc(i, x, 2.2, z, 1.45, 0.9, 1.45, x, 2.85, z);
        }
      },
    },
    macro: {
      cap:
        '<b>宏内核（大内核）</b>：所有系统功能都运行在<b>内核态</b>、共享同一地址空间。性能高，但内核庞大、一处出错即全系统崩溃。',
      hint: '典型：<b>Linux</b>；优点 <b>性能高</b>，缺点 <b>可靠性 / 可维护性差</b>。',
      apply() {
        shellAt(6.9, 3.35, 4.9, 2.15);
        shell.material.opacity = 0.2;
        shellLb.visible = true;
        shellLb.position.set(-3.9, 4.02, 0);
        for (let i = 0; i < N; i++) {
          const c = i % 3;
          const r = i < 3 ? 1.35 : 2.62;
          const x = -2.0 + c * 2.0;
          setSvc(i, x, r, 0, 1.72, 0.95, 1.72, x, r + 0.62, 0);
        }
      },
    },
    micro: {
      cap:
        '<b>微内核</b>：内核只保留<b>最基本</b>的功能（进程通信、低级调度、中断），文件/驱动等移到用户态，靠<b>消息传递</b>协作。可靠、易扩展，但通信开销大。',
      hint: '典型：<b>Mach、QNX</b>；优点 <b>可靠、可扩展</b>，缺点 <b>性能开销大</b>。',
      apply() {
        shellAt(1.95, 1.95, 1.95, 2.3);
        shell.material.opacity = 0.35;
        shellLb.visible = true;
        shellLb.position.set(0, 3.5, 0);
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(a) * 3.85;
          const z = Math.sin(a) * 3.05;
          setSvc(i, x, 2.3, z, 1.5, 0.9, 1.5, x, 2.95, z);
        }
      },
    },
    exo: {
      cap:
        '<b>外核</b>：内核只负责<b>物理资源的分配与保护</b>，把「物理块」直接交给应用，由应用自己管理。省去一层映射，但应用要自己写资源管理。',
      hint: '外核 = 内核只做<b>资源分配</b>，不做抽象；应用与硬件之间几乎没有中间层。',
      apply() {
        shellAt(7.0, 0.6, 5.2, 3.15);
        shell.material.opacity = 0.28;
        shellLb.visible = true;
        shellLb.position.set(-4.5, 3.15, 0);
        for (let i = 0; i < N; i++) {
          const x = -4.45 + i * 1.78;
          setSvc(i, x, 0.95, 0, 1.55, 1.0, 1.9, x, 1.62, 0);
        }
      },
    },
  };

  const applyMode = (key) => {
    mode = key;
    const m = MODES[key];
    m.apply();
    svcs.forEach((s) => (s.label.visible = key !== 'macro'));
    msgs.forEach((s) => (s.visible = key === 'micro'));
    grants.forEach((a) => (a.visible = key === 'exo'));
    links.forEach((l) => (l.visible = key === 'modular'));
    host.cap(m.cap);
    host.hint(m.hint);
  };

  const btns = host.toolbar([
    { label: '分层结构', active: true, onClick: (b) => (pick(b), applyMode('layered')) },
    { label: '模块化', onClick: (b) => (pick(b), applyMode('modular')) },
    { label: '宏内核', onClick: (b) => (pick(b), applyMode('macro')) },
    { label: '微内核', onClick: (b) => (pick(b), applyMode('micro')) },
    { label: '外核', onClick: (b) => (pick(b), applyMode('exo')) },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  applyMode('layered');

  /* ---------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    phase += dt;
    const k = Math.min(1, dt * 3.6);

    svcs.forEach((s, i) => {
      s.mesh.position.lerp(s.wantP, k);
      s.mesh.scale.lerp(s.wantS, k);
      s.label.position.lerp(s.wantL, k);
      s.mesh.material.emissiveIntensity = 0.24 + Math.sin(t * 1.7 + i * 0.8) * 0.06;
    });

    // 微内核：消息在「内核 ↔ 各模块」之间往返
    if (mode === 'micro') {
      msgs.forEach((m, j) => {
        const idx = (Math.floor(phase * 0.9) + j * 3) % N;
        const s = svcs[idx];
        const u = (phase * 1.1 + j * 0.5) % 2;
        const k2 = u < 1 ? u : 2 - u;
        const from = new THREE.Vector3(0, 2.3, 0);
        m.position.lerpVectors(from, s.mesh.position, k2);
        m.position.y = 2.3 + Math.sin(t * 4 + j) * 0.1;
        m.scale.setScalar(1 + Math.sin(t * 7 + j) * 0.14);
      });
    }

    // 外核：内核向应用「分配物理块」的授权箭头
    if (mode === 'exo') {
      grants.forEach((a, i) => {
        const s = svcs[i].mesh.position;
        a.position.set(0, 0, 0);
        const ln = a.children && a.children[0];
        if (ln && ln.geometry) {
          const pts = [new THREE.Vector3(0, 2.85, 0), new THREE.Vector3(s.x, 1.45, 0)];
          ln.geometry.setFromPoints(pts);
          ln.geometry.attributes.position.needsUpdate = true;
        }
        const head = a.children && a.children[1];
        if (head) {
          head.position.set(s.x, 1.42, 0);
          const d = new THREE.Vector3(s.x, 1.42 - 2.85, 0).normalize();
          head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
        }
        const lnMat = ln && ln.material;
        if (lnMat) lnMat.opacity = 0.35 + Math.sin(t * 3 + i * 0.7) * 0.2;
        grants[i].visible = true;
      });
    }

    // 模块化：中心到各模块的连线
    if (mode === 'modular') {
      links.forEach((l, i) => {
        const s = svcs[i].mesh.position;
        const ln = l.children && l.children[0];
        if (ln && ln.geometry) {
          ln.geometry.setFromPoints([new THREE.Vector3(0, 2.2, 0), new THREE.Vector3(s.x * 0.62, 2.2, s.z * 0.62)]);
          ln.geometry.attributes.position.needsUpdate = true;
        }
        const head = l.children && l.children[1];
        if (head) head.position.set(s.x * 0.62, 2.2, s.z * 0.62);
      });
    }

    // 壳体与文字（壳体随结构平滑变形）
    shell.position.lerp(shellWant.pos, k);
    shell.scale.lerp(shellWant.scale, k);
    const lbY = mode === 'exo' ? 3.15 : shell.position.y + shell.scale.y / 2 + 0.18;
    shellLb.position.y += (lbY - shellLb.position.y) * k;
    shell.material.opacity = (mode === 'micro' ? 0.3 : mode === 'macro' ? 0.19 : mode === 'exo' ? 0.26 : 0.11) + Math.sin(t * 1.4) * 0.02;
    app.position.y = 5.35 + Math.sin(t * 1.1) * 0.03;
    appLb.position.y = app.position.y;
  });
}
