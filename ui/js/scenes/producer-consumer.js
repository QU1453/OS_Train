/**
 * producer-consumer.js —— 生产者-消费者问题（2.3.5）
 *
 * 演示：
 *   · 三个信号量：mutex = 1（互斥访问缓冲区）、empty = n（空闲格数）、full = 0（已放产品数）；
 *   · 生产者：P(empty) → P(mutex) → 放入 → V(mutex) → V(full)；
 *   · 消费者：P(full) → P(mutex) → 取出 → V(mutex) → V(empty)；
 *   · 不变式：empty + full = n；
 *   · 关键点「先同步后互斥」：两个 P 的顺序颠倒（先 P(mutex) 后 P(empty)）会死锁。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  box,
  sphere,
  cylinder,
  grid,
  arrow,
  clamp01,
  easeInOut,
} from './_runtime.js';

const N = 4; // 缓冲区容量 n

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0, 9.6, 15.8],
    target: [0, 1.3, 0.4],
    minDist: 11,
    maxDist: 44,
    maxPolarAngle: Math.PI * 0.49,
    label: 'PRODUCER / CONSUMER',
  });
  const p = host.p;
  host.scene.add(grid(26));

  const slotX = (i) => -3 + i * 2;
  const SLOT_Y = 0.32;
  const PROD = new THREE.Vector3(-6.1, 1.25, 3.1);
  const CONS = new THREE.Vector3(6.1, 1.25, 3.1);

  /* --------------------------------------------------------- 有界缓冲区 */
  const slots = [];
  for (let i = 0; i < N; i++) {
    const sock = box(1.5, 0.16, 1.5, p.surface3, { edges: false, opacity: 0.6 });
    sock.position.set(slotX(i), 0.24, 0);
    host.scene.add(sock);
    const rim = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5, 0.16, 1.5)),
      new THREE.LineBasicMaterial({ color: new THREE.Color(p.line2), transparent: true, opacity: 0.75 })
    );
    rim.position.copy(sock.position);
    host.scene.add(rim);
    slots.push({ x: slotX(i), occupied: false, mesh: null });
  }
  const bufTitle = textSprite(`有界缓冲区 buffer[n = ${N}]`, {
    color: p.def,
    bg: 'rgba(255,255,255,0.88)',
    border: p.def,
    height: 0.58,
  });
  bufTitle.position.set(0, 2.55, 0);
  host.scene.add(bufTitle);

  /* -------------------------------------------- 方向箭头（生产 / 消费） */
  host.scene.add(arrow(new THREE.Vector3(PROD.x + 0.65, 1.0, PROD.z - 0.6), new THREE.Vector3(-3.7, 0.7, 0.7), p.key, { opacity: 0.5 }));
  host.scene.add(arrow(new THREE.Vector3(3.7, 0.7, 0.7), new THREE.Vector3(CONS.x - 0.65, 1.0, CONS.z - 0.6), p.def, { opacity: 0.5 }));

  /* ----------------------------------------------------------- 信号量面板 */
  const SEMZ = -3.5;
  const sems = [
    { key: 'mutex', label: 'mutex', v: 1, color: p.def, x: -3.8, note: '互斥信号量 初值 1' },
    { key: 'empty', label: 'empty', v: N, color: p.memo, x: 0, note: `空闲缓冲区数 初值 n=${N}` },
    { key: 'full', label: 'full', v: 0, color: p.accent2, x: 3.8, note: '已存放产品数 初值 0' },
  ];
  const semVal = {};
  sems.forEach((s) => {
    const col = cylinder(0.55, 0.7, 1.9, p.surface3, {
      emissive: s.color,
      emissiveIntensity: 0.12,
      roughness: 0.42,
    });
    col.position.set(s.x, 0.95, SEMZ);
    host.scene.add(col);
    const name = textSprite(s.label, { color: s.color, height: 0.5 });
    name.position.set(s.x, 2.45, SEMZ);
    host.scene.add(name);
    const val = textSprite(String(s.v), { color: p.bg0, bg: s.color, height: 0.64 });
    val.position.set(s.x, 1.0, SEMZ + 0.72);
    host.scene.add(val);
    semVal[s.key] = val;
    const note = textSprite(s.note, { color: p.text3, height: 0.34 });
    note.position.set(s.x, -0.4, SEMZ);
    host.scene.add(note);
  });

  /* ------------------------------------------------------------ 进程球体 */
  const mkProc = (pos, color, text) => {
    const orb = sphere(0.5, color, { emissive: color, emissiveIntensity: 0.5 });
    orb.position.copy(pos);
    host.scene.add(orb);
    const lab = textSprite(text, { color: p.text1, height: 0.44 });
    lab.position.set(pos.x, pos.y + 0.98, pos.z);
    host.scene.add(lab);
    return { orb, lab };
  };
  const prod = mkProc(PROD, p.key, '生产者 Producer');
  const cons = mkProc(CONS, p.def, '消费者 Consumer');

  const retext = (sprite, text, opts) => {
    const next = textSprite(text, opts);
    sprite.material.map.dispose();
    sprite.material.map = next.material.map;
    sprite.material.needsUpdate = true;
    sprite.scale.set(next.scale.x, next.scale.y, 1);
    next.material.dispose();
  };

  /* -------------------------------------------------------------- 状态量 */
  const sem = { mutex: 1, empty: N, full: 0 };
  const flights = []; // 产品飞行动画
  let order = 'ok'; // ok | buggy（颠倒两个 P 的顺序）
  let deadlock = false;
  let prodPulse = 0;
  let consPulse = 0;

  const DEADCAP =
    '<b style="color:var(--sem-warn)">死锁</b>：生产者先 <b>P(mutex)</b> 拿到锁后，又因 <b>empty = 0</b> 被阻塞；' +
    '消费者要取产品必须先拿 mutex，于是双方<b>循环等待</b>，谁都无法推进。';

  const render = () => {
    sems.forEach((s) => {
      const v = sem[s.key];
      const col = v > 0 ? s.color : p.warn;
      retext(semVal[s.key], String(v), { color: p.bg0, bg: col, height: 0.64 });
    });
  };

  const putAt = (i) => {
    if (i < 0) i = slots.findIndex((s) => !s.occupied);
    if (i < 0) return;
    const mesh = box(0.88, 0.6, 0.88, p.accent2, {
      emissive: p.accent2,
      emissiveIntensity: 0.28,
      roughness: 0.4,
      edgeOpacity: 0.25,
    });
    mesh.position.copy(PROD);
    mesh.scale.setScalar(0.01);
    host.scene.add(mesh);
    slots[i].occupied = true;
    slots[i].mesh = mesh;
    flights.push({ mesh, a: PROD.clone(), b: new THREE.Vector3(slotX(i), SLOT_Y + 0.31, 0), t: 0, dur: 0.5, grow: true });
  };

  const takeAt = () => {
    const i = slots.findIndex((s) => s.occupied);
    if (i < 0) return false;
    const mesh = slots[i].mesh;
    slots[i].occupied = false;
    slots[i].mesh = null;
    if (mesh) flights.push({ mesh, a: mesh.position.clone(), b: CONS.clone(), t: 0, dur: 0.5, kill: true });
    return true;
  };

  const reset = () => {
    sem.mutex = 1;
    sem.empty = N;
    sem.full = 0;
    order = 'ok';
    deadlock = false;
    slots.forEach((s) => {
      if (s.mesh) {
        host.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
      }
      s.occupied = false;
      s.mesh = null;
    });
    flights.length = 0;
    btns[2].classList.remove('is-active');
    host.hint('顺序：<b>正确</b> —— 生产者 P(empty)→P(mutex)，消费者 P(full)→P(mutex)（先同步后互斥）。');
    render();
    host.cap('缓冲区空。点击 <b>生产</b> / <b>消费</b> 观察 empty、full 与缓冲区的变化（不变式 empty + full = n）。');
  };

  const pulse = (btn) => btn && btn.animate && btn.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 260 });

  /* -------------------------------------------------------------- 生产者 */
  const produce = (btn) => {
    if (deadlock) {
      host.cap(DEADCAP);
      pulse(btn);
      return;
    }
    if (order === 'buggy') {
      // 错误顺序：先 P(mutex) 再 P(empty)
      if (sem.mutex <= 0) {
        host.cap('<b>生产者</b>：想先 P(mutex)，但 mutex = 0 → 阻塞，无法进入临界区。');
        pulse(btn);
        return;
      }
      sem.mutex--;
      if (sem.empty <= 0) {
        deadlock = true;
        render();
        host.cap(DEADCAP);
        pulse(btn);
        return;
      }
      sem.empty--;
      putAt(-1);
      sem.mutex++;
      sem.full++;
      prodPulse = 1;
      host.cap(
        `<b>生产者（错误顺序）</b>：P(mutex)→P(empty)→放入→V(mutex)→V(full)。` +
          `此刻恰好腾出锁，侥幸完成；但 <i>empty = 0 时就会死锁</i>。empty=${sem.empty}，full=${sem.full}。`
      );
      render();
      pulse(btn);
      return;
    }
    // 正确顺序：先 P(empty)
    if (sem.empty <= 0) {
      host.cap(
        '<b>生产者</b>：缓冲区已满（<b>empty = 0</b>）→ 执行 P(empty) 时被阻塞，<i>主动让出处理机</i>，等待消费者取走产品后唤醒。'
      );
      pulse(btn);
      return;
    }
    sem.empty--;
    sem.mutex--;
    putAt(-1);
    sem.mutex++;
    sem.full++;
    prodPulse = 1;
    host.cap(
      `<b>生产者</b>：P(empty) → P(mutex) → <i>放入产品</i> → V(mutex) → V(full)。` +
        `empty=${sem.empty}，full=${sem.full}。`
    );
    render();
    pulse(btn);
  };

  /* -------------------------------------------------------------- 消费者 */
  const consume = (btn) => {
    if (deadlock) {
      host.cap(DEADCAP);
      pulse(btn);
      return;
    }
    if (order === 'buggy') {
      if (sem.mutex <= 0) {
        deadlock = true;
        render();
        host.cap('<b>消费者</b>：P(mutex) 时 mutex = 0 → 被阻塞 → 与生产者形成循环等待，<b style="color:var(--sem-warn)">死锁</b>。');
        pulse(btn);
        return;
      }
      sem.mutex--;
      if (sem.full <= 0) {
        sem.mutex++;
        host.cap('<b>消费者（错误顺序）</b>：缓冲区空（full = 0）→ 阻塞等待产品。');
        render();
        pulse(btn);
        return;
      }
      sem.full--;
      takeAt();
      sem.mutex++;
      sem.empty++;
      consPulse = 1;
      host.cap(
        `<b>消费者（错误顺序）</b>：P(mutex)→P(full)→取出→V(mutex)→V(empty)。empty=${sem.empty}，full=${sem.full}。`
      );
      render();
      pulse(btn);
      return;
    }
    // 正确顺序：先 P(full)
    if (sem.full <= 0) {
      host.cap(
        '<b>消费者</b>：缓冲区为空（<b>full = 0</b>）→ 执行 P(full) 时被阻塞，<i>主动让出处理机</i>，等待生产者放入产品后唤醒。'
      );
      pulse(btn);
      return;
    }
    sem.full--;
    sem.mutex--;
    takeAt();
    sem.mutex++;
    sem.empty++;
    consPulse = 1;
    host.cap(
      `<b>消费者</b>：P(full) → P(mutex) → <i>取出产品</i> → V(mutex) → V(empty)。` +
        `empty=${sem.empty}，full=${sem.full}。`
    );
    render();
    pulse(btn);
  };

  /* -------------------------------------------------------------- 交互条 */
  const btns = host.toolbar([
    { label: '生产（Producer）', onClick: (b) => produce(b) },
    { label: '消费（Consumer）', onClick: (b) => consume(b) },
    {
      label: '颠倒 P 顺序（演示死锁）',
      onClick: (b) => {
        order = order === 'ok' ? 'buggy' : 'ok';
        b.classList.toggle('is-active', order === 'buggy');
        reset2();
        if (order === 'buggy') {
          host.hint('顺序：<b style="color:var(--sem-warn)">颠倒</b> —— 先 P(mutex) 后 P(empty/full)，缓冲区满或空时将<b>死锁</b>。');
          host.cap('已切换到<b>错误顺序</b>。请连续点击 <b>生产</b> 直到缓冲区填满，再点一次即可看到死锁。');
        }
      },
    },
    { label: '重置', onClick: () => reset() },
  ]);

  // 切换顺序时只清空缓冲区与状态，保留当前 order 选中态
  const reset2 = () => {
    sem.mutex = 1;
    sem.empty = N;
    sem.full = 0;
    deadlock = false;
    slots.forEach((s) => {
      if (s.mesh) {
        host.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
      }
      s.occupied = false;
      s.mesh = null;
    });
    flights.length = 0;
    render();
  };

  host.hint('顺序：<b>正确</b> —— 生产者 P(empty)→P(mutex)，消费者 P(full)→P(mutex)（先同步后互斥）。');
  reset();

  /* -------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    // 产品飞行
    for (let k = flights.length - 1; k >= 0; k--) {
      const a = flights[k];
      a.t += dt;
      const e = clamp01(a.t / a.dur);
      const ee = easeInOut(e);
      a.mesh.position.lerpVectors(a.a, a.b, ee);
      if (a.grow) a.mesh.scale.setScalar(0.01 + ee * 0.99);
      if (a.kill) a.mesh.scale.setScalar(Math.max(0.01, 1 - e));
      if (e >= 1) {
        if (a.kill) {
          host.scene.remove(a.mesh);
          a.mesh.geometry.dispose();
          a.mesh.material.dispose();
        } else {
          a.mesh.scale.setScalar(1);
        }
        flights.splice(k, 1);
      }
    }

    // 进程球呼吸 / 脉冲
    prodPulse = Math.max(0, prodPulse - dt * 2.2);
    consPulse = Math.max(0, consPulse - dt * 2.2);

    const pk = deadlock ? p.err : p.key;
    prod.orb.material.color.set(pk);
    prod.orb.material.emissive.set(pk);
    prod.orb.material.emissiveIntensity = (deadlock ? 0.85 : 0.5) + prodPulse * 0.9 + Math.sin(t * 2.4) * 0.06;
    prod.orb.scale.setScalar(1 + prodPulse * 0.2);
    prod.orb.position.y = PROD.y + Math.sin(t * 1.6) * 0.06;
    prod.lab.position.set(prod.orb.position.x, prod.orb.position.y + 0.98, prod.orb.position.z);

    const ck = deadlock ? p.err : p.def;
    cons.orb.material.color.set(ck);
    cons.orb.material.emissive.set(ck);
    cons.orb.material.emissiveIntensity = (deadlock ? 0.85 : 0.5) + consPulse * 0.9 + Math.sin(t * 2.4 + 1.1) * 0.06;
    cons.orb.scale.setScalar(1 + consPulse * 0.2);
    cons.orb.position.y = CONS.y + Math.sin(t * 1.6 + 1.2) * 0.06;
    cons.lab.position.set(cons.orb.position.x, cons.orb.position.y + 0.98, cons.orb.position.z);

    // 产品在槽内轻微上浮
    slots.forEach((s, i) => {
      if (s.mesh && flights.every((f) => f.mesh !== s.mesh)) {
        s.mesh.position.y = SLOT_Y + 0.31 + Math.sin(t * 2 + i) * 0.02;
      }
    });
  });
}
