/**
 * os-map.js —— 第 1 章知识框架（1.7 本章小结）
 *
 * 中心一个「操作系统」核心，四条分支悬浮在四周：
 *   概念 → 发展 → 运行环境 → 结构
 * 点按钮逐个聚焦，其余分支变暗，帮助建立整体框架。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  box,
  sphere,
  arrow,
  grid,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0, 10.5, 16.5],
    target: [0, 0.4, 0],
    minDist: 11,
    maxDist: 46,
    maxPolarAngle: Math.PI * 0.48,
    label: '第 1 章知识框架',
  });
  const p = host.p;
  host.scene.add(grid(34));

  /* ---------------------------------------------------------------- 核心 */
  const core = box(2.5, 1.1, 2.5, p.accent, {
    emissive: p.accent,
    emissiveIntensity: 0.3,
    roughness: 0.35,
    pos: [0, 0.9, 0],
  });
  host.scene.add(core);
  const coreLb = textSprite('操作系统', { color: '#FFFFFF', bg: p.accent, border: p.accent, height: 0.6 });
  coreLb.position.set(0, 1.78, 0);
  host.scene.add(coreLb);

  /* ---------------------------------------------------------------- 分支 */
  const BR = [
    {
      key: 'concept',
      title: '① 基本概念',
      color: p.def,
      x: -5.2,
      z: -2.6,
      kids: ['定义：管理资源 + 扩充机器', '四大特征：并发 / 共享 / 虚拟 / 异步', '四大管理 + 两类接口'],
      cap:
        '<b>概念是根</b>：操作系统 = 管理硬件与软件资源、合理组织多道程序运行、方便用户的<b>系统软件</b>；它的价值在于把裸机变成<b>扩充机器</b>。',
      hint: '高频辨析：<b>并发 ≠ 并行</b>；<b>并发与共享</b>互为存在条件。',
    },
    {
      key: 'history',
      title: '② 发展历程',
      color: p.memo,
      x: 5.2,
      z: -2.6,
      kids: ['手工操作：无 OS', '单道批处理 → 多道批处理', '分时系统 → 实时系统'],
      cap:
        '<b>一条主线</b>：从「人机串行」到「多道并发」。多道批处理让操作系统<b>正式诞生</b>，分时靠<b>时间片轮转</b>保证交互，实时靠<b>截止时间</b>保证可靠。',
      hint: '记关键词：单道=<b>串行</b>，多道=<b>并发+提高利用率</b>，分时=<b>及时性/交互性</b>，实时=<b>可靠性/截止时间</b>。',
    },
    {
      key: 'env',
      title: '③ 运行环境',
      color: p.key,
      x: -5.2,
      z: 3.4,
      kids: ['内核态 / 用户态（PSW）', '中断与异常（内中断 / 外中断）', '系统调用：程序的唯一入口'],
      cap:
        '<b>两态一机制</b>：CPU 靠 <b>PSW 特权位</b>区分内核态/用户态；用户程序想用特权资源，只能通过<b>系统调用</b>触发<b>陷入（访管中断）</b>进入内核态。',
      hint: '用户态 → 内核态：唯一的合法途径是<b>中断/异常</b>；内核态 → 用户态靠<b>返回指令</b>。',
    },
    {
      key: 'struct',
      title: '④ 体系结构',
      color: p.exam,
      x: 5.2,
      z: 3.4,
      kids: ['分层 / 模块化', '宏内核 / 微内核 / 外核', '虚拟机：Type-1 / Type-2'],
      cap:
        '<b>一条权衡</b>：内核越大 → 性能越好、可靠性越差；内核越小 → 越可靠、通信开销越大。<b>微内核</b>只留最基本功能，靠<b>消息传递</b>协作。',
      hint: 'Linux 是<b>宏内核</b>；Mach / QNX 是<b>微内核</b>；外核只做<b>资源分配</b>不做抽象。',
    },
  ];

  const nodes = BR.map((b) => {
    const g = new THREE.Group();
    host.scene.add(g);
    const panel = box(4.9, 0.9, 2.9, b.color, {
      opacity: 0.82,
      emissive: b.color,
      emissiveIntensity: 0.12,
      roughness: 0.45,
      pos: [b.x, 0.9, b.z],
    });
    g.add(panel);
    const title = textSprite(b.title, { color: p.text1, height: 0.58 });
    title.position.set(b.x, 1.62, b.z);
    g.add(title);

    const kids = b.kids.map((s, i) => {
      const sp = textSprite(s, { color: p.text2, height: 0.4 });
      sp.position.set(b.x + (b.x > 0 ? 0.5 : -0.5), 2.35 + i * 0.62, b.z);
      sp.material.opacity = 0;
      g.add(sp);
      return sp;
    });

    const link = arrow(
      new THREE.Vector3(b.x * 0.24, 0.9, b.z * 0.24),
      new THREE.Vector3(b.x * 0.7, 0.9, b.z * 0.7),
      b.color,
      { headR: 0.11, opacity: 0.55 },
    );
    host.scene.add(link);

    // 竖杆把面板与分支点连起来
    const stem = box(0.1, 0.9, 0.1, b.color, { opacity: 0.4, emissive: b.color, pos: [b.x, 1.2, b.z] });
    g.add(stem);

    return { b, g, panel, title, kids, link };
  });

  /* ------------------------------------------------------------ 光点装饰 */
  const orbit = [];
  for (let i = 0; i < 14; i++) {
    const s = sphere(0.075, p.line2, { seg: 12 });
    host.scene.add(s);
    orbit.push(s);
  }

  /* ---------------------------------------------------------------- 状态 */
  let focus = null; // null = 总览

  const apply = (key) => {
    focus = key;
    nodes.forEach((n) => {
      const on = !key || n.b.key === key;
      n.panel.material.opacity = on ? 0.82 : 0.16;
      n.panel.material.emissiveIntensity = on ? 0.16 : 0.03;
      n.title.material.opacity = on ? 1 : 0.3;
      n.kids.forEach((s, i) => (s.material.opacity = on && key ? 1 : 0));
      n.g.userData.on = on;
    });
    if (!key) {
      host.cap(
        '<b>四条主线</b>：概念 → 发展 → 运行环境 → 结构。点上方按钮逐个聚焦，把散点串成框架。',
      );
      host.hint('总览模式：<b>先抓这四块</b>，第 1 章就不会散。');
    } else {
      const n = nodes.find((x) => x.b.key === key);
      host.cap(n.b.cap);
      host.hint(n.b.hint);
    }
  };

  const LABELS = ['总览', '① 基本概念', '② 发展历程', '③ 运行环境', '④ 体系结构'];
  const KEYS = [null, 'concept', 'history', 'env', 'struct'];
  const btns = host.toolbar(
    LABELS.map((label, i) => ({ label, active: i === 0, onClick: (b) => (pick(b), apply(KEYS[i])) })),
  );
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  apply(null);

  /* ---------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    const k = Math.min(1, dt * 3.4);
    nodes.forEach((n, i) => {
      const on = n.g.userData.on !== false;
      const lift = on ? Math.sin(t * 1.5 + i) * 0.09 : -0.25;
      n.panel.position.y += (0.9 + lift - n.panel.position.y) * k;
      n.title.position.y += (1.62 + lift - n.title.position.y) * k;
      n.kids.forEach((s, j) => {
        const base = 2.35 + j * 0.62 + (focus ? Math.sin(t * 1.2 + j * 0.7) * 0.05 : 0);
        s.position.y += (base + lift - s.position.y) * k;
      });
    });

    core.rotation.y += dt * 0.28;
    coreLb.material.opacity = 0.92 + Math.sin(t * 2.4) * 0.08;

    orbit.forEach((s, i) => {
      const a = t * 0.45 + (i / orbit.length) * Math.PI * 2;
      const r = 9.2 + Math.sin(t * 0.7 + i) * 0.5;
      s.position.set(Math.cos(a) * r, 3.2 + Math.sin(t * 0.9 + i * 1.7) * 1.5, Math.sin(a) * r * 0.65);
      s.scale.setScalar(0.7 + Math.sin(t * 2 + i) * 0.3);
    });
  });
}
