/**
 * semaphore-pv.js —— 记录型信号量的 P / V 与让权等待（2.3.3）
 *
 * 演示：
 *   · P 操作：value--，若无可用资源则 <b>block</b>（进入等待队列，让出 CPU）；
 *   · V 操作：value++，若队列中仍有等待者则 <b>wakeup</b>（唤醒一个）；
 *   · value 的双重含义：>0 表示剩余资源数，<0 表示等待进程数；
 *   · 与「整型信号量忙等」对比：整型信号量不满足让权等待。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  box,
  sphere,
  cylinder,
  grid,
} from './_runtime.js';

const N = 3; // 信号量初值（资源数量）

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0.5, 9.5, 15.5],
    target: [0, 1.4, 0],
    minDist: 10,
    maxDist: 40,
    maxPolarAngle: Math.PI * 0.49,
    label: 'SEMAPHORE  P / V',
  });
  const p = host.p;
  host.scene.add(grid(24));

  const POOL_X = -4.7;
  const QUE_X = 4.7;
  const slotZ = (i, n) => (i - (n - 1) / 2) * 1.75;
  const poolPos = (i) => new THREE.Vector3(POOL_X, 0.9, slotZ(i, N));
  const quePos = (j) => new THREE.Vector3(QUE_X, 0.9, slotZ(j, 4));

  /* ------------------------------------------------------------ 资源槽 */
  for (let i = 0; i < N; i++) {
    const sock = box(1.5, 0.14, 1.5, p.surface3, { edges: false, edgeColor: p.def, opacity: 0.55 });
    sock.position.copy(poolPos(i)).setY(0.07);
    host.scene.add(sock);
    const rimL = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5, 0.14, 1.5)),
      new THREE.LineBasicMaterial({ color: new THREE.Color(p.def), transparent: true, opacity: 0.5 })
    );
    rimL.position.copy(sock.position);
    host.scene.add(rimL);
  }
  const poolTitle = textSprite('资源池 · 初值 N = 3', { color: p.def, bg: 'rgba(255,255,255,0.88)', border: p.def, height: 0.58 });
  poolTitle.position.set(POOL_X, 2.55, 0);
  host.scene.add(poolTitle);

  /* ------------------------------------------------------------ 等待队列 */
  for (let j = 0; j < 4; j++) {
    const sock = box(1.5, 0.14, 1.5, p.surface3, { edges: false, opacity: 0.4 });
    sock.position.copy(quePos(j)).setY(0.07);
    host.scene.add(sock);
  }
  const queTitle = textSprite('等待队列 S.L（阻塞进程）', { color: p.warn, bg: 'rgba(255,255,255,0.88)', border: p.warn, height: 0.58 });
  queTitle.position.set(QUE_X, 2.55, 0);
  host.scene.add(queTitle);

  /* ------------------------------------------------------- 中央 value 柱 */
  const pillar = cylinder(0.8, 1.0, 2.6, p.surface3, {
    emissive: p.accent,
    emissiveIntensity: 0.1,
    roughness: 0.4,
  });
  pillar.position.set(0, 1.3, 0);
  host.scene.add(pillar);
  const pTitle = textSprite('SEMAPHORE  S', { color: p.accent, height: 0.5 });
  pTitle.position.set(0, 2.95, 0);
  host.scene.add(pTitle);

  let valueSprite = textSprite('S.value = 3', { color: p.bg0, bg: p.accent, height: 0.78 });
  valueSprite.position.set(0, 1.35, 1.02);
  host.scene.add(valueSprite);
  const capSprite = textSprite('剩余资源数', { color: p.text3, height: 0.42 });
  capSprite.position.set(0, 0.72, 1.02);
  host.scene.add(capSprite);

  const retext = (sprite, text, opts) => {
    const next = textSprite(text, opts);
    sprite.material.map.dispose();
    sprite.material.map = next.material.map;
    sprite.material.needsUpdate = true;
    sprite.scale.set(next.scale.x, next.scale.y, 1);
    next.material.dispose();
  };

  /* ------------------------------------------------------------ 进程小球 */
  const orbs = [];
  const mkOrb = (name) => {
    const m = sphere(0.34, p.key, { emissive: p.key, emissiveIntensity: 0.5 });
    m.position.set(0, 0.9, 8.4);
    host.scene.add(m);
    const lab = textSprite(name, { color: p.text1, height: 0.36 });
    host.scene.add(lab);
    const o = { name, mesh: m, label: lab, state: 'spawn', slot: 0, ang: Math.random() * 6.28 };
    orbs.push(o);
    return o;
  };

  /* -------------------------------------------------------------- 状态 */
  let free = N;
  let busy = 0;
  let seq = 0;
  const holders = []; // {o, slot}
  const waitQ = []; // {o, slot}
  let mode = 'record'; // record | integer

  const nextPoolSlot = () => {
    for (let i = 0; i < N; i++) if (!holders.some((h) => h.slot === i)) return i;
    return 0;
  };

  const readout = () => {
    const value = free - waitQ.length;
    const col = value > 0 ? p.memo : value < 0 ? p.warn : p.accent;
    retext(valueSprite, `S.value = ${value}`, { color: p.bg0, bg: col, height: 0.78 });
    retext(
      capSprite,
      value > 0 ? '剩余可用资源数' : value < 0 ? `等待进程数 = ${-value}` : '资源恰好用完 / 无等待',
      { color: p.text3, height: 0.42 }
    );
    return value;
  };

  const P = (btn) => {
    const name = 'P' + ++seq;
    const o = mkOrb(name);
    if (free > 0) {
      free--;
      const slot = nextPoolSlot();
      holders.push({ o, slot });
      o.state = 'holding';
      o.slot = slot;
      host.cap(`<b>P(S)</b>：${name} 申请成功 → S.value-- → 占用一个资源。<i>value &gt; 0 表示还有剩余资源</i>。`);
    } else if (mode === 'record') {
      const slot = waitQ.length;
      waitQ.push({ o, slot });
      o.state = 'blocked';
      o.slot = slot;
      host.cap(`<b>P(S)</b>：无可用资源 → S.value 变为负 → 调用 <b>block(S.L)</b>，${name} <i>主动阻塞并让出处理机</i>（满足让权等待）。`);
    } else {
      o.state = 'busy';
      o.slot = busy++;
      host.cap(`<b>P(S)</b>：整型信号量资源不足 → <code>while(S&lt;=0);</code> 原地<b>空转忙等</b>，${name} <i>不让出 CPU</i>，<b>违背让权等待</b>！`);
    }
    readout();
    btn && pulse(btn);
  };

  const V = (btn) => {
    if (waitQ.length > 0) {
      const w = waitQ.shift();
      waitQ.forEach((q, i) => (q.slot = i));
      const slot = nextPoolSlot();
      holders.push({ o: w.o, slot });
      w.o.state = 'holding';
      w.o.slot = slot;
      host.cap(`<b>V(S)</b>：S.value++ 后仍 ≤ 0 → 调用 <b>wakeup(S.L)</b>，唤醒队首 ${w.o.name} 并把资源交给它（阻塞态 → 就绪态）。`);
    } else if (mode === 'integer' && busy > 0) {
      // 整型：忙等的进程自行抢到资源
      const o = orbs.find((x) => x.state === 'busy');
      if (o) {
        busy--;
        const slot = nextPoolSlot();
        holders.push({ o, slot });
        o.state = 'holding';
        o.slot = slot;
      }
      host.cap('<b>V(S)</b>：释放一个资源，正在忙等的进程自行退出空转循环、拿到资源。');
    } else if (free < N) {
      free++;
      host.cap('<b>V(S)</b>：无等待进程 → S.value++ → <i>归还一个资源到资源池</i>。');
    } else {
      host.cap('<b>V(S)</b>：当前资源已全部空闲，仍执行 S.value++。');
      free++;
    }
    readout();
    btn && pulse(btn);
  };

  const reset = () => {
    free = N;
    busy = 0;
    seq = 0;
    holders.length = 0;
    waitQ.length = 0;
    orbs.forEach((o) => {
      o.mesh.visible = false;
      o.label.visible = false;
    });
    readout();
    host.cap('已重置：S.value = 3（资源池满、等待队列空）。点击 <b>P 操作</b> 或 <b>V 操作</b> 观察变化。');
  };

  const pulse = (btn) => {
    btn.animate && btn.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 260 });
  };

  /* -------------------------------------------------------------- 交互 */
  const btns = host.toolbar([
    { label: 'P 操作（申请）', onClick: (b) => P(b) },
    { label: 'V 操作（释放）', onClick: (b) => V(b) },
    {
      label: '整型信号量',
      onClick: (b) => {
        mode = mode === 'record' ? 'integer' : 'record';
        b.classList.toggle('is-active', mode === 'integer');
        host.hint(
          mode === 'integer'
            ? '模式：<b>整型信号量</b> —— 资源不足时原地空转（忙等），<b>不满足让权等待</b>。'
            : '模式：<b>记录型信号量</b> —— 资源不足时阻塞入队（让权等待）。'
        );
        reset();
      },
    },
    { label: '重置', onClick: () => reset() },
  ]);
  btns[0].classList.add('is-active');

  host.hint('模式：<b>记录型信号量</b> —— 资源不足时阻塞入队（让权等待）。');
  reset();
  host.cap('点击 <b>P 操作</b>（申请资源）与 <b>V 操作</b>（释放资源），观察 <b>S.value</b> 与等待队列的变化。');

  /* -------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    const k = Math.min(1, dt * 4.5);
    orbs.forEach((o) => {
      if (!o.mesh.visible) return;
      let target;
      if (o.state === 'holding') target = poolPos(o.slot);
      else if (o.state === 'blocked') target = quePos(o.slot);
      else if (o.state === 'busy') {
        o.ang += dt * 2.4;
        const r = 1.6 + (o.slot % 2) * 0.9;
        target = new THREE.Vector3(POOL_X + Math.cos(o.ang) * r, 0.9 + Math.sin(o.ang * 2) * 0.18, 4.6 + Math.sin(o.ang) * r);
      } else target = new THREE.Vector3(0, 0.9, 8.4);
      o.mesh.position.lerp(target, k);
      o.label.position.set(o.mesh.position.x, o.mesh.position.y + 0.72, o.mesh.position.z);
      o.label.material.opacity = 1;
      o.mesh.scale.setScalar(1 + Math.sin(t * 3 + o.slot) * 0.05);
      o.mesh.material.emissiveIntensity = o.state === 'blocked' ? 0.25 : o.state === 'busy' ? 1.0 : 0.6;
      o.mesh.material.color.set(o.state === 'blocked' ? p.warn : o.state === 'busy' ? p.err : p.key);
      o.mesh.material.emissive.set(o.state === 'blocked' ? p.warn : o.state === 'busy' ? p.err : p.key);
    });
  });
}
