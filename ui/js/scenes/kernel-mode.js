/**
 * kernel-mode.js —— 用户态 / 内核态与状态切换（1.3）
 *
 * 演示：CPU 在「用户态（目态）」与「内核态（管态）」之间切换的两种路径。
 *   · 用户态 → 内核态：只能由「中断 / 异常（含系统调用的陷入 trap）」触发，硬件自动完成；
 *   · 内核态 → 用户态：由操作系统执行一条特权指令、修改 PSW 标志位完成。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  box,
  sphere,
  ring,
  arrow,
  line,
  grid,
  lerp,
  clamp01,
  easeInOut,
} from './_runtime.js';

const USER = new THREE.Vector3(-3.3, 1.2, 0);
const KERN = new THREE.Vector3(3.3, 1.2, 0);

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0, 5.6, 13.4],
    target: [0, 2.1, 0],
    minDist: 7,
    maxDist: 34,
    maxPolarAngle: Math.PI * 0.47,
    label: 'USER / KERNEL MODE',
  });
  const p = host.p;
  host.scene.add(grid(22));

  const put = (obj, x, y, z) => {
    obj.position.set(x, y, z);
    host.scene.add(obj);
    return obj;
  };

  /* ---------------------------------------------------- 两块「运行态」平台 */
  const mkPad = (x, color) =>
    box(5.7, 0.42, 5.2, p.surface3, {
      pos: [x, 0.21, 0],
      emissive: color,
      emissiveIntensity: 0.07,
      edgeColor: color,
      edgeOpacity: 0.4,
      roughness: 0.45,
    });
  put(mkPad(-3.3, p.def), 0, 0, 0);
  put(mkPad(3.3, p.accent), 0, 0, 0);

  put(
    textSprite('用户态 · 目态', { color: p.def, bg: 'rgba(255,255,255,0.88)', border: p.def, height: 0.62 }),
    -3.3,
    0.78,
    3.05
  );
  put(
    textSprite('内核态 · 管态', { color: p.accent, bg: 'rgba(255,255,255,0.88)', border: p.accent, height: 0.62 }),
    3.3,
    0.78,
    3.05
  );

  /* ------------------------------------------- 两侧可执行的指令（示意方块） */
  const cmdBox = (x, z, color, label) => {
    const m = box(1.15, 0.5, 1.15, p.surface3, {
      pos: [x, 0.68, z],
      emissive: color,
      emissiveIntensity: 0.16,
      edgeColor: color,
      edgeOpacity: 0.35,
    });
    host.scene.add(m);
    const s = textSprite(label, { color, height: 0.44 });
    s.position.set(x, 0.68, z + 0.02);
    host.scene.add(s);
  };
  cmdBox(-4.5, -1.2, p.def, '普通指令');
  cmdBox(-3.3, -1.2, p.def, '普通指令');
  cmdBox(-2.1, -1.2, p.def, '普通指令');
  cmdBox(2.1, -1.2, p.accent, '特权指令');
  cmdBox(3.3, -1.2, p.accent, '特权指令');
  cmdBox(4.5, -1.2, p.accent, '特权指令');

  put(
    textSprite('只能执行非特权指令', { color: p.text2, height: 0.46 }),
    -3.3,
    0.72,
    -2.35
  );
  put(
    textSprite('可执行特权指令 · 访问全部资源', { color: p.text2, height: 0.46 }),
    3.3,
    0.72,
    -2.35
  );

  /* ------------------------------------------------------------ 分界墙 */
  const wall = line(
    [new THREE.Vector3(0, 0.2, -2.7), new THREE.Vector3(0, 4.6, -2.7)],
    p.line2,
    { dash: 0.22, gap: 0.16, opacity: 0.55 }
  );
  host.scene.add(wall);
  const wl = textSprite('特权级边界', { color: p.text3, height: 0.44 });
  wl.position.set(0, 4.95, -2.7);
  host.scene.add(wl);

  /* --------------------------------------------------------- 两条转换路径 */
  // 用户态 → 内核态（上）
  host.scene.add(arrow(new THREE.Vector3(-2.1, 3.35, 0), new THREE.Vector3(2.1, 3.35, 0), p.warn, { headR: 0.15, opacity: 0.95 }));
  put(
    textSprite('中断 / 异常（trap）', { color: p.warn, bg: 'rgba(255,255,255,0.88)', border: p.warn, height: 0.56 }),
    0,
    4.05,
    0
  );
  put(textSprite('硬件自动完成 · 隐指令', { color: p.text3, height: 0.42 }), 0, 4.66, 0);

  // 内核态 → 用户态（下）
  host.scene.add(arrow(new THREE.Vector3(2.1, 2.05, 0), new THREE.Vector3(-2.1, 2.05, 0), p.memo, { headR: 0.15, opacity: 0.95 }));
  put(
    textSprite('特权指令：修改 PSW', { color: p.memo, bg: 'rgba(255,255,255,0.88)', border: p.memo, height: 0.56 }),
    0,
    2.72,
    0
  );

  /* ------------------------------------------------------------- 执行令牌 */
  const token = sphere(0.4, p.accent2, { emissive: p.accent2, emissiveIntensity: 0.85 });
  token.position.copy(USER);
  host.scene.add(token);
  const halo = ring(0.55, 0.74, p.accent2, { opacity: 0.4 });
  halo.rotation.x = -Math.PI / 2;
  halo.position.copy(USER).setY(0.06);
  host.scene.add(halo);

  const tokenLabel = textSprite('CPU', { color: p.bg0, bg: p.accent2, height: 0.5 });
  host.scene.add(tokenLabel);

  /* -------------------------------------------------------------- 交互 */
  let mode = 'user';
  const target = USER.clone();
  let glowT = 0;
  let pulse = 0;

  const setMode = (m, cap) => {
    mode = m;
    target.copy(m === 'user' ? USER : KERN);
    host.cap(cap);
    host.hint(
      m === 'user'
        ? '当前：<b>用户态</b> —— 只能执行非特权指令。'
        : '当前：<b>内核态</b> —— 可执行特权指令、访问全部资源。'
    );
    glowT = 0;
  };

  const btns = host.toolbar([
    { label: '用户代码', active: true, onClick: (b) => { btns.forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active'); setMode('user', '用户程序执行中：只能执行<b>非特权指令</b>，不能访问内核数据；要获得内核服务只能通过「陷入」。'); } },
    { label: '系统调用', onClick: (b) => { btns.forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active'); setMode('kernel', '执行<b>系统调用</b> → 陷入（trap）→ 用户态→内核态。<u>由硬件自动完成，是一条隐指令，不是特权指令</u>。'); } },
    { label: '中断 / 异常', onClick: (b) => { btns.forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active'); setMode('kernel', '发生<b>中断或异常</b> → 硬件自动切换到内核态，转入相应的处理程序。'); } },
    { label: '返回用户态', onClick: (b) => { btns.forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active'); setMode('user', '内核处理完毕 → 执行<b>特权指令</b>、修改 PSW 标志位 → 回到用户态继续执行。'); } },
  ]);

  setMode('user', '点击下方按钮，观察 CPU 如何在<b>用户态</b>与<b>内核态</b>之间切换。');

  host.onTick((t, dt) => {
    const k = 1 - Math.pow(0.0015, dt); // 指数趋近
    token.position.x = lerp(token.position.x, target.x, k);
    token.position.y = lerp(token.position.y, target.y, k);
    token.position.z = lerp(token.position.z, target.z, k);

    pulse += dt;
    const s = 1 + Math.sin(pulse * 3.4) * 0.06;
    token.scale.setScalar(s);
    tokenLabel.position.set(token.position.x, token.position.y + 0.78, token.position.z);
    halo.position.set(token.position.x, 0.07, token.position.z);
    halo.rotation.z += dt * 0.9;

    glowT = clamp01(glowT + dt * 2.2);
    const e = easeInOut(glowT);
    const col = mode === 'user' ? p.def : p.accent;
    token.material.emissive.lerpColors(new THREE.Color(p.accent2), new THREE.Color(col), e);
  });
}
