/**
 * os-boot.js —— 操作系统的引导（1.5）
 *
 * 一个「控制权光球」从加电开始，逐级向上穿过五层：
 *   固件自检 → 主引导记录 → 引导程序 → 内核初始化 → 用户环境
 * 每层只做一件事，做完就把执行权交给下一层——这就是「引导」的本质。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  retext,
  box,
  cylinder,
  ring,
  arrow,
  grid,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [10.5, 7.0, 13.5],
    target: [0, 3.6, 0],
    minDist: 10,
    maxDist: 40,
    maxPolarAngle: Math.PI * 0.49,
    label: '操作系统引导：五层接力',
  });
  const p = host.p;
  host.scene.add(grid(30));

  const LAYERS = [
    {
      t: '① 固件自检（BIOS / UEFI）',
      c: p.quote,
      cap:
        '<b>加电 → 自检 → 找启动盘</b>：固件执行 POST 检查 CPU、内存、外设，然后按启动顺序读第一块设备的<b>第一个扇区</b>。',
      hint: '这一层<b>还不是操作系统</b>，只是一段固化在主板 ROM 里的程序。',
    },
    {
      t: '② 主引导记录 MBR',
      c: p.memo,
      cap:
        '<b>MBR = 0 号扇区，共 512 字节</b>：446 字节引导代码 + 64 字节分区表 + 2 字节结束标志 55AA。它只负责找到<b>活动分区</b>的引导程序并装入内存。',
      hint: '考点：MBR <b>不含操作系统内核</b>，只含「找内核的代码」与分区表。',
    },
    {
      t: '③ 引导程序 Bootloader',
      c: p.def,
      cap:
        '<b>GRUB / LILO / NTLOADER</b>：按配置把<b>操作系统内核</b>从磁盘读入内存指定位置，建立必要的启动参数，然后跳到内核入口。',
      hint: '引导程序是「搬运工」：把内核搬到内存，再把 CPU 交给它。',
    },
    {
      t: '④ 内核初始化',
      c: p.accent,
      cap:
        '<b>建立中断向量表、初始化页表与各类数据结构、创建设备与文件系统</b>，最后启动第一个进程（0 号 / init 进程）。',
      hint: '内核开始接管：从这一刻起，资源分配由<b>操作系统</b>说了算。',
    },
    {
      t: '⑤ 用户环境',
      c: p.accent2,
      cap:
        '<b>登录 shell 或图形桌面启动</b>，操作系统完成引导，进入「用户可用」状态。',
      hint: '至此，<b>扩充机器</b>搭建完成，用户面对的不再是裸机。',
    },
  ];

  const GAP = 1.55;
  const BASE = 0.62;
  const Y = (i) => BASE + i * GAP;

  /* --------------------------------------------------------------- 层板 */
  const plates = LAYERS.map((L, i) => {
    const pl = box(7.6, 0.3, 4.6, L.c, {
      opacity: 0.9,
      roughness: 0.55,
      emissive: L.c,
      emissiveIntensity: 0.06,
    });
    pl.position.set(0, Y(i), 0);
    host.scene.add(pl);
    const lb = textSprite(L.t, { color: p.text1, height: 0.46 });
    lb.position.set(0, Y(i) + 0.44, 2.05);
    host.scene.add(lb);
    const halo = ring(0.5, 0.62, L.c, { seg: 48, opacity: 0 });
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(-3.15, Y(i) + 0.2, 0);
    host.scene.add(halo);
    return { pl, lb, halo, on: false };
  });

  /* ----------------------------------------------------------- 电源底座 */
  const pwr = cylinder(1.0, 1.2, 0.34, p.surface3, { seg: 32 });
  pwr.position.set(-3.15, 0.17, 0);
  host.scene.add(pwr);
  const pwrLb = textSprite('加电', { color: p.text2, height: 0.38 });
  pwrLb.position.set(-3.15, 0.17, 0.95);
  host.scene.add(pwrLb);

  /* --------------------------------------------------------- 上升箭头 */
  const spine = arrow(
    new THREE.Vector3(-3.15, 0.45, 0),
    new THREE.Vector3(-3.15, Y(LAYERS.length - 1) + 0.35, 0),
    p.line2,
    { headR: 0.14, opacity: 0.5 },
  );
  host.scene.add(spine);

  /* ------------------------------------------------------- 控制权光球 */
  const token = cylinder(0.16, 0.16, 0.1, p.exam, {
    seg: 24,
    emissive: p.exam,
    emissiveIntensity: 1.1,
  });
  token.rotation.x = Math.PI / 2;
  token.position.set(-3.15, 0.4, 0);
  host.scene.add(token);
  const tokenLb = textSprite('控制权', { color: p.exam, height: 0.34 });
  host.scene.add(tokenLb);

  /* --------------------------------------------------------------- 状态 */
  let idx = -1;
  let playing = true;
  let hold = 0;

  const target = new THREE.Vector3(-3.15, 0.4, 0);

  function apply(i) {
    idx = i;
    const L = LAYERS[i];
    plates.forEach((pl, j) => {
      pl.on = j <= i;
      pl.halo.material.opacity = j === i ? 0.9 : j < i ? 0.28 : 0;
    });
    target.set(-3.15, i < 0 ? 0.42 : Y(i) + 0.42, 0);
    host.cap(i < 0 ? '<b>点击「下一步」开始引导</b>：光球代表「执行权」，它走到哪一层，哪一层就开始工作。' : L.cap);
    host.hint(i < 0 ? '共 <b>五层</b>，一层做完把执行权交给下一层。' : L.hint);
    hold = 0;
  }

  const btns = host.toolbar([
    { label: '上一步', onClick: () => { playing = false; pick(btns[0]); apply(Math.max(-1, idx - 1)); } },
    { label: '下一步', onClick: () => { playing = false; pick(btns[1]); apply(idx >= LAYERS.length - 1 ? 0 : idx + 1); } },
    { label: '自动播放', active: true, onClick: (b) => { playing = true; pick(b); hold = 0; } },
    { label: '复位', onClick: () => { playing = false; pick(btns[3]); apply(-1); } },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  apply(-1);

  /* ---------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    const k = Math.min(1, dt * 4.2);
    token.position.lerp(target, k);
    token.position.x = -3.15 + Math.sin(t * 3) * 0.05;
    tokenLb.position.set(-1.55, token.position.y + 0.02, 0);

    // 已点亮的层板呼吸，当前层最亮
    plates.forEach((pl, j) => {
      const want = pl.on ? (j === idx ? 0.3 : 0.12) : 0.05;
      pl.pl.material.emissiveIntensity += (want + Math.sin(t * 1.9 + j * 0.6) * 0.04 - pl.pl.material.emissiveIntensity) * k;
      pl.lb.material.opacity += ((pl.on ? 1 : 0.42) - pl.lb.material.opacity) * k;
      pl.halo.scale.setScalar(1 + Math.sin(t * 4 + j) * 0.12);
    });

    if (playing) {
      hold += dt;
      if (hold > 1.85) {
        if (idx >= LAYERS.length - 1) apply(0);
        else apply(idx + 1);
        hold = 0;
      }
    }
    pwrLb.material.opacity = 0.65 + Math.sin(t * 5) * 0.2;
  });
}
