/**
 * os-vm.js —— 虚拟机（1.6）
 *
 * 左右两座「栈」对比两类虚拟机监控器：
 *   左：Type-1 裸金属型（硬件 → VMM → 各客户 OS）
 *   右：Type-2 宿主型（硬件 → 宿主 OS → VMM → 各客户 OS）
 * 一颗「资源请求」光球沿线上下往返，直观看出 Type-2 多绕了一层。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  box,
  cylinder,
  grid,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [11.0, 8.4, 15.0],
    target: [0, 2.9, 0],
    minDist: 10,
    maxDist: 44,
    maxPolarAngle: Math.PI * 0.49,
    label: '两类虚拟机监控器（VMM）',
  });
  const p = host.p;
  host.scene.add(grid(32));

  const plate = (parent, x, y, w, d, color, text, h = 0.46, opt = {}) => {
    const m = box(w, 0.28, d, color, {
      opacity: opt.opacity ?? 0.92,
      emissive: color,
      emissiveIntensity: opt.glow ?? 0.08,
      roughness: 0.5,
      pos: [x, y, 0],
    });
    parent.add(m);
    const lb = textSprite(text, { color: p.text1, height: h });
    lb.position.set(x, y + 0.34, d / 2 + 0.02);
    parent.add(lb);
    return { m, lb };
  };

  /* ============================================================ Type-1 */
  const g1 = new THREE.Group();
  host.scene.add(g1);
  const X1 = -3.7;
  plate(g1, X1, 0.36, 6.4, 4.6, p.surface3, '硬件', 0.5, { glow: 0.03 });
  const vmm1 = plate(g1, X1, 1.58, 6.4, 4.6, p.accent, 'VMM（裸金属型 Hypervisor）', 0.48, { glow: 0.26 });
  plate(g1, X1 - 1.62, 2.80, 2.9, 3.4, p.def, '客户 OS 1');
  plate(g1, X1 + 1.62, 2.80, 2.9, 3.4, p.def, '客户 OS 2');
  plate(g1, X1 - 1.62, 4.02, 2.9, 3.4, p.memo, '应用', 0.4, { glow: 0.05 });
  plate(g1, X1 + 1.62, 4.02, 2.9, 3.4, p.memo, '应用', 0.4, { glow: 0.05 });
  const t1 = cylinder(0.15, 0.15, 0.09, p.exam, { seg: 24, emissive: p.exam, emissiveIntensity: 1.0 });
  t1.rotation.x = Math.PI / 2;
  g1.add(t1);
  const HOP1 = [4.02, 2.80, 1.58, 0.36];
  const XROUTE1 = X1 - 1.62;

  /* ============================================================ Type-2 */
  const g2 = new THREE.Group();
  host.scene.add(g2);
  const X2 = 3.7;
  plate(g2, X2, 0.36, 6.4, 4.6, p.surface3, '硬件', 0.5, { glow: 0.03 });
  plate(g2, X2, 1.58, 6.4, 4.6, p.quote, '宿主操作系统（Host OS）', 0.46, { glow: 0.1 });
  const vmm2 = plate(g2, X2, 2.80, 6.4, 4.6, p.accent, 'VMM（宿主型，一个应用程序）', 0.46, { glow: 0.26 });
  plate(g2, X2 - 1.62, 4.02, 2.9, 3.4, p.def, '客户 OS 1');
  plate(g2, X2 + 1.62, 4.02, 2.9, 3.4, p.def, '客户 OS 2');
  plate(g2, X2 - 1.62, 5.24, 2.9, 3.4, p.memo, '应用', 0.4, { glow: 0.05 });
  plate(g2, X2 + 1.62, 5.24, 2.9, 3.4, p.memo, '应用', 0.4, { glow: 0.05 });
  const t2 = cylinder(0.15, 0.15, 0.09, p.exam, { seg: 24, emissive: p.exam, emissiveIntensity: 1.0 });
  t2.rotation.x = Math.PI / 2;
  g2.add(t2);
  const HOP2 = [5.24, 4.02, 2.80, 1.58, 0.36];
  const XROUTE2 = X2 - 1.62;

  /* --------------------------------------------------------------- 图例 */
  const lg1 = textSprite('Type-1 裸金属型', { color: p.accent, height: 0.52 });
  lg1.position.set(X1, 4.95, 0);
  host.scene.add(lg1);
  const lg2 = textSprite('Type-2 宿主型', { color: p.accent, height: 0.52 });
  lg2.position.set(X2, 6.15, 0);
  host.scene.add(lg2);

  /* --------------------------------------------------------------- 状态 */
  let mode = 'both';
  let phase = 0;
  const NOTES = {
    both: {
      cap:
        '左边 <b>Type-1</b>：VMM 直接跑在硬件上；右边 <b>Type-2</b>：VMM 只是宿主 OS 上的一个程序。客户 OS 的每次硬件访问，Type-2 都要<b>多穿一层</b>。',
      hint: '数一数光球下到「硬件」要走几层：Type-1 = <b>3 层</b>，Type-2 = <b>4 层</b>。',
    },
    t1: {
      cap:
        '<b>Type-1（裸金属 / 原生）</b>：VMM 直接管理硬件，客户 OS 运行在最高特权级之下。典型：<b>VMware ESXi、Xen、Hyper-V</b>。性能好、开销小，但需要独占整台机器。',
      hint: '优点：<b>性能高</b>（少一层）；缺点：<b>要专用硬件</b>。',
    },
    t2: {
      cap:
        '<b>Type-2（宿主型）</b>：先装宿主 OS，再在它上面装 VMM 程序（如 VMware Workstation、VirtualBox）。兼容性好、安装简单，但每层转换都带来开销。',
      hint: '优点：<b>安装简单、可与宿主共享文件</b>；缺点：<b>性能较低</b>。',
    },
  };

  const apply = (key) => {
    mode = key;
    g1.visible = key !== 't2';
    g2.visible = key !== 't1';
    lg1.visible = g1.visible;
    lg2.visible = g2.visible;
    host.cap(NOTES[key].cap);
    host.hint(NOTES[key].hint);
  };

  const btns = host.toolbar([
    { label: '并排对比', active: true, onClick: (b) => (pick(b), apply('both')) },
    { label: '只看 Type-1', onClick: (b) => (pick(b), apply('t1')) },
    { label: '只看 Type-2', onClick: (b) => (pick(b), apply('t2')) },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  apply('both');

  /* ---------------------------------------------------------------- 每帧 */
  const flyTo = (token, hops, x, t, phase0) => {
    const u = ((phase0 + t * 0.42) % 2 + 2) % 2;      // 0→1 下行，1→2 上行
    const v = u < 1 ? u : 2 - u;
    const seg = v * (hops.length - 1);
    const i = Math.min(hops.length - 2, Math.floor(seg));
    const f = seg - i;
    const y = hops[i] + (hops[i + 1] - hops[i]) * f;
    token.position.set(x, y, 0.45);
    token.rotation.z += 0.16;
  };

  host.onTick((t, dt) => {
    phase += dt;
    if (g1.visible) flyTo(t1, HOP1, XROUTE1, t, 0);
    if (g2.visible) flyTo(t2, HOP2, XROUTE2, t, 0.35);
    vmm1.m.material.emissiveIntensity = 0.2 + Math.sin(t * 2.2) * 0.08;
    vmm2.m.material.emissiveIntensity = 0.2 + Math.sin(t * 2.2 + 1.1) * 0.08;
  });
}
