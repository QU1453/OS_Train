/**
 * os-concept.js —— 操作系统在计算机系统中的位置（1.1）
 *
 * 演示：
 *   · 三层结构：硬件（裸机）→ 操作系统 → 用户 / 应用程序；
 *   · 四大管理模块（处理机 / 存储器 / 文件 / 设备）嵌在 OS 层上；
 *   · 「裸机」与「扩充机器（虚拟机）」两种视角的差别；
 *   · 系统调用的往返：应用请求 → OS 处理 → 返回结果。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  box,
  sphere,
  arrow,
  grid,
  clamp01,
  easeInOut,
} from './_runtime.js';

const LW = 9.2;
const LD = 6.2;

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [10.5, 8.6, 13.5],
    target: [0, 1.5, 0],
    minDist: 9,
    maxDist: 40,
    maxPolarAngle: Math.PI * 0.49,
    label: 'OS 在系统中的位置',
  });
  const p = host.p;
  host.scene.add(grid(28));

  /* ---------------------------------------------------------- 硬件（裸机） */
  const hw = box(LW, 0.5, LD, p.surface3, { roughness: 0.75 });
  hw.position.set(0, 0.25, 0);
  host.scene.add(hw);
  const hwLb = textSprite('硬件 · 裸机', {
    color: p.text1,
    bg: 'rgba(255,255,255,0.92)',
    border: p.line2,
    height: 0.62,
  });
  hwLb.position.set(0, 0.3, LD / 2 + 0.95);
  host.scene.add(hwLb);

  /* 裸机上直接跑程序（裸机视角时才显示） */
  const bareProg = [];
  for (let i = 0; i < 3; i++) {
    const b = box(1.1, 0.32, 1.1, p.quote, { opacity: 0.75 });
    b.position.set(-2.6 + i * 2.6, 0.66, 1.2);
    host.scene.add(b);
    bareProg.push(b);
  }

  /* -------------------------------------------------------------- OS 层 */
  const osSlab = box(LW, 1.05, LD, p.def, {
    opacity: 0.9,
    roughness: 0.35,
    emissive: p.def,
    emissiveIntensity: 0.1,
  });
  osSlab.position.set(0, 1.12, 0);
  host.scene.add(osSlab);

  const osLb = textSprite('操作系统（系统软件）', {
    color: p.bg0,
    bg: p.def,
    height: 0.66,
  });
  osLb.position.set(0, 1.12, LD / 2 + 0.9);
  host.scene.add(osLb);

  /* 四大管理模块：嵌在 OS 层正面的四块面板 */
  const MODS = [
    { name: '处理机管理', color: p.memo, x: -3.35 },
    { name: '存储器管理', color: p.accent, x: -1.12 },
    { name: '文件管理', color: p.accent2, x: 1.12 },
    { name: '设备管理', color: p.key, x: 3.35 },
  ];
  const modCubes = [];
  MODS.forEach((m) => {
    const c = box(1.75, 0.72, 0.3, m.color, {
      emissive: m.color,
      emissiveIntensity: 0.3,
      roughness: 0.4,
    });
    c.position.set(m.x, 1.12, LD / 2 + 0.06);
    host.scene.add(c);
    const lb = textSprite(m.name, { color: p.text2, height: 0.4 });
    lb.position.set(m.x, 0.78, LD / 2 + 0.62);
    host.scene.add(lb);
    modCubes.push({ mesh: c, label: lb, base: 0.3 });
  });

  /* -------------------------------------------------------- 用户 / 应用层 */
  const appSlab = box(LW, 0.7, LD, p.surface, { opacity: 0.95, roughness: 0.5 });
  appSlab.position.set(0, 2.5, 0);
  host.scene.add(appSlab);
  const appLb = textSprite('用户 · 应用程序', {
    color: p.text1,
    bg: 'rgba(255,255,255,0.92)',
    border: p.line2,
    height: 0.62,
  });
  appLb.position.set(0, 2.5, LD / 2 + 0.95);
  host.scene.add(appLb);

  const procs = [];
  for (let i = 0; i < 3; i++) {
    const s = sphere(0.3, p.accent2, { emissive: p.accent2, emissiveIntensity: 0.45 });
    s.position.set(-2.4 + i * 2.4, 3.15, -1.1);
    host.scene.add(s);
    const lb = textSprite('进程' + (i + 1), { color: p.text3, height: 0.34 });
    lb.position.set(s.position.x, 3.56, -1.1);
    host.scene.add(lb);
    procs.push({ mesh: s, label: lb, ph: i * 0.9 });
  }

  /* ------------------------------------------------------------- 两条箭头 */
  const aCall = arrow(new THREE.Vector3(-3.0, 2.15, -2.0), new THREE.Vector3(-3.0, 1.68, -2.0), p.memo, {
    headR: 0.13,
    opacity: 0.9,
  });
  const aRet = arrow(new THREE.Vector3(1.0, 1.68, -2.0), new THREE.Vector3(1.0, 2.15, -2.0), p.accent2, {
    headR: 0.13,
    opacity: 0.9,
  });
  const aCallLb = textSprite('系统调用', { color: p.memo, height: 0.38 });
  aCallLb.position.set(-4.55, 1.9, -2.0);
  const aRetLb = textSprite('返回结果', { color: p.accent2, height: 0.38 });
  aRetLb.position.set(2.6, 1.9, -2.0);
  const aHw = arrow(new THREE.Vector3(3.0, 0.6, -2.0), new THREE.Vector3(3.0, 1.04, -2.0), p.text3, {
    headR: 0.11,
    opacity: 0.75,
  });
  const aHwLb = textSprite('中断 / 驱动', { color: p.text3, height: 0.36 });
  aHwLb.position.set(4.75, 0.82, -2.0);
  host.scene.add(aCall, aRet, aHw, aCallLb, aRetLb, aHwLb);

  /* --------------------------------------------------------------- 令牌 */
  const token = sphere(0.26, p.exam, { emissive: p.exam, emissiveIntensity: 0.9 });
  token.visible = false;
  host.scene.add(token);
  let travel = -1;
  let travelDir = 0;

  /* --------------------------------------------------------------- 状态 */
  let mode = 'full';
  let pulseAll = 0;
  let pulseIdx = -1;

  const setVisible = (v) => {
    [osSlab, osLb, appSlab, appLb].forEach((m) => (m.visible = v));
    modCubes.forEach((m) => {
      m.mesh.visible = v;
      m.label.visible = v;
    });
    procs.forEach((m) => {
      m.mesh.visible = v;
      m.label.visible = v;
    });
    [aCall, aRet, aCallLb, aRetLb, aHw, aHwLb].forEach((m) => (m.visible = v));
    // 裸机视角：程序直接贴着硬件跑
    bareProg.forEach((b) => (b.visible = !v));
  };

  const setCap = (h) => host.cap(h);

  const showFull = () => {
    mode = 'full';
    setVisible(true);
    setCap(
      '这就是<b>扩充机器（虚拟机）</b>视角：OS 把裸机包了一层，向上提供<b>命令接口</b>与<b>程序接口（系统调用）</b>，向下屏蔽硬件细节。'
    );
    host.hint('三大功能：<b>资源管理者</b>（四大管理）· <b>用户与硬件的接口</b> · <b>扩充机器</b>');
  };

  const showBare = () => {
    mode = 'bare';
    setVisible(false);
    setCap(
      '<b>裸机</b>：没有任何软件支持的计算机。程序必须自己管寄存器、自己算扇区地址——这正是 OS 存在的理由。'
    );
    host.hint('没有任何软件支持的计算机 = <b>裸机</b>；覆盖了软件层 = <b>扩充机器</b>。');
  };

  const doMods = () => {
    mode = 'mods';
    setVisible(true);
    pulseIdx = 0;
    pulseAll = 4.4;
    setCap('<b>作为资源管理者</b>：OS 的四大功能——处理机、存储器、文件、设备，逐一点亮。');
    host.hint('口诀：<b>处理机、存储器、文件、设备</b>（"机存文设"）。');
  };

  const doCall = () => {
    mode = 'call';
    setVisible(true);
    token.visible = true;
    travel = 0;
    travelDir = 0;
    token.position.set(-3.0, 2.15, -2.0);
    setCap('用户进程要读文件 → 触发<b>系统调用</b>（自愿中断）→ 陷入内核 → OS 完成服务后<b>返回用户态</b>。');
    host.hint('<b>系统调用</b>属于程序接口，是「广义指令」；它不是命令接口，也不能在用户态直接执行。');
  };

  const btns = host.toolbar([
    { label: '扩充机器', onClick: (b) => (pick(b), showFull()) },
    { label: '裸机', onClick: (b) => (pick(b), showBare()) },
    { label: '四大管理', onClick: (b) => (pick(b), doMods()) },
    { label: '发起系统调用', onClick: (b) => (pick(b), doCall()) },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  showFull();

  /* ---------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    // 进程小球轻微悬浮
    procs.forEach((m) => {
      if (!m.mesh.visible) return;
      m.mesh.position.y = 3.15 + Math.sin(t * 1.6 + m.ph) * 0.1;
      m.label.position.y = m.mesh.position.y + 0.41;
      m.mesh.scale.setScalar(1 + Math.sin(t * 2.2 + m.ph) * 0.04);
    });

    // 四大模块脉冲
    if (pulseAll > 0) {
      pulseAll = Math.max(0, pulseAll - dt);
      const step = Math.floor((4.4 - pulseAll) / 0.7) % 4;
      pulseIdx = step;
      modCubes.forEach((m, i) => {
        const on = i === pulseIdx;
        m.base += ((on ? 1.15 : 0.28) - m.base) * Math.min(1, dt * 8);
        m.mesh.material.emissiveIntensity = m.base;
        m.mesh.scale.setScalar(1 + (on ? 0.06 : 0));
      });
    } else {
      modCubes.forEach((m) => {
        m.mesh.material.emissiveIntensity = 0.28 + Math.sin(t * 1.4) * 0.05;
        m.mesh.scale.setScalar(1);
      });
    }

    // 系统调用令牌往返
    if (mode === 'call' && travel >= 0) {
      travel = clamp01(travel + dt / 1.5);
      const e = easeInOut(travel);
      if (travelDir === 0) {
        token.position.set(-3.0, 2.15 - e * 0.47, -2.0);
        if (travel >= 1) {
          travel = 0;
          travelDir = 1;
        }
      } else {
        token.position.set(-3.0 + e * 4.0, 1.68 + e * 0.47, -2.0);
        if (travel >= 1) {
          travel = -1;
          token.visible = false;
          setCap('服务完成，结果写回用户缓冲区。<i>一次系统调用 = 一次「用户态 → 内核态 → 用户态」的完整往返</i>。');
        }
      }
      token.scale.setScalar(1 + Math.sin(t * 8) * 0.12);
    }

    // 箭头呼吸（arrow() 返回 Group，真正的线在 children[0] 上）
    const aCallLine = aCall.children && aCall.children[0];
    if (aCallLine && aCallLine.material) aCallLine.material.opacity = 0.55 + Math.sin(t * 3) * 0.2;
    aHwLb.position.y = 0.82 + Math.sin(t * 2) * 0.03;
  });
}
