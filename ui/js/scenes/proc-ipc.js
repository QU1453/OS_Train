/**
 * proc-ipc.js —— 进程通信（2.1.4）
 *
 * 两条进程之间搭三条「信道」，逐条点亮对比：
 *   共享内存（快，但需同步） / 消息传递（信箱·消息队列） / 管道（半双工字节流）
 */
import {
  THREE,
  SceneHost,
  textSprite,
  box,
  cylinder,
  sphere,
  arrow,
  grid,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [6.6, 9.4, 14.5],
    target: [0, 1.4, 0],
    minDist: 10,
    maxDist: 42,
    maxPolarAngle: Math.PI * 0.48,
    label: '三条进程间通信信道',
  });
  const p = host.p;
  host.scene.add(grid(32));

  const proc = (x, t, c) => {
    const m = box(2.4, 1.7, 2.4, c, {
      opacity: 0.92,
      emissive: c,
      emissiveIntensity: 0.14,
      roughness: 0.45,
      pos: [x, 1.35, 0],
    });
    host.scene.add(m);
    const lb = textSprite(t, { color: p.text1, height: 0.5 });
    lb.position.set(x, 2.62, 0);
    host.scene.add(lb);
    return { m, lb, x };
  };
  const A = proc(-7.6, '进程 A（发送方）', p.def);
  const B = proc(7.6, '进程 B（接收方）', p.accent);

  /* ==================================================== ① 共享内存 */
  const Z1 = -3.0;
  const shm = box(4.6, 0.4, 2.2, p.memo, {
    opacity: 0.42,
    emissive: p.memo,
    emissiveIntensity: 0.1,
    pos: [0, 1.35, Z1],
  });
  host.scene.add(shm);
  const shmLb = textSprite('共享存储区', { color: p.memo, height: 0.42 });
  shmLb.position.set(0, 0.62, Z1);
  host.scene.add(shmLb);
  const shmNote = textSprite('直接读写内存 · 最快 · 必须自己加锁', { color: p.text3, height: 0.32 });
  shmNote.position.set(0, 1.9, Z1);
  host.scene.add(shmNote);
  const shmA = arrow(new THREE.Vector3(-6.2, 1.35, Z1), new THREE.Vector3(-2.6, 1.35, Z1), p.line2, { headR: 0.12, opacity: 0.6 });
  const shmB = arrow(new THREE.Vector3(2.6, 1.35, Z1), new THREE.Vector3(6.2, 1.35, Z1), p.line2, { headR: 0.12, opacity: 0.6 });
  host.scene.add(shmA, shmB);
  const shmData = [0, 1].map(() => {
    const s = sphere(0.19, p.memo, { emissive: p.memo, emissiveIntensity: 0.8, seg: 20 });
    host.scene.add(s);
    return s;
  });

  /* ==================================================== ② 消息传递 */
  const Z2 = 0;
  const boxA = box(2.0, 1.3, 1.7, p.key, { opacity: 0.5, emissive: p.key, emissiveIntensity: 0.12, pos: [-3.5, 1.3, Z2] });
  const boxB = box(2.0, 1.3, 1.7, p.key, { opacity: 0.5, emissive: p.key, emissiveIntensity: 0.12, pos: [3.5, 1.3, Z2] });
  host.scene.add(boxA, boxB);
  const boxALb = textSprite('发送信箱', { color: p.key, height: 0.34 });
  boxALb.position.set(-3.5, 0.5, Z2);
  host.scene.add(boxALb);
  const boxBLb = textSprite('接收信箱', { color: p.key, height: 0.34 });
  boxBLb.position.set(3.5, 0.5, Z2);
  host.scene.add(boxBLb);
  const msgNote = textSprite('消息 = 数据 + 消息头（发送者/接收者/长度）', { color: p.text3, height: 0.32 });
  msgNote.position.set(0, 2.35, Z2);
  host.scene.add(msgNote);
  const msgs = [0, 1, 2].map(() => {
    const s = sphere(0.16, p.key, { emissive: p.key, emissiveIntensity: 0.9, seg: 16 });
    host.scene.add(s);
    return s;
  });

  /* ==================================================== ③ 管道 */
  const Z3 = 3.0;
  const pipe = cylinder(0.42, 0.42, 12.0, p.surface3, { seg: 24, open: true, side: THREE.DoubleSide });
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0, 1.4, Z3);
  host.scene.add(pipe);
  const pipeLb = textSprite('管道 pipe（半双工：同一时刻只能单向）', { color: p.text2, height: 0.4 });
  pipeLb.position.set(0, 2.3, Z3);
  host.scene.add(pipeLb);
  const pipeBytes = [0, 1, 2, 3].map(() => {
    const s = sphere(0.14, p.def, { emissive: p.def, emissiveIntensity: 0.7, seg: 14 });
    host.scene.add(s);
    return s;
  });

  /* --------------------------------------------------------------- 状态 */
  const NOTES = {
    shm: {
      cap:
        '<b>共享内存</b>：由系统在两进程地址空间中划出<b>同一块物理内存</b>。读写无需陷入内核，<b>速度最快</b>；代价是必须<b>自己解决同步互斥</b>（配信号量/互斥量）。',
      hint: '共享内存 = <b>最快</b>的 IPC，但<b>不是</b>最安全的：必须额外加锁。',
    },
    msg: {
      cap:
        '<b>消息传递</b>：以<b>消息（数据 + 消息头）</b>为单位，经内核的<b>消息队列 / 信箱</b>在进程间传递。可直接通信或间接通信（通过信箱），天然屏蔽底层细节。',
      hint: '消息传递要<b>陷入内核</b>：每发一条消息就是一次系统调用，开销比共享内存大。',
    },
    pipe: {
      cap:
        '<b>管道</b>：一段<b>内核缓冲区</b>，本质是<b>共享文件</b>，按<b>字符流</b>写入读出。半双工：同一时刻只能一个方向；写满则写进程阻塞，读空则读进程阻塞。',
      hint: '管道三类考点：<b>半双工</b>、<b>写满阻塞 / 读空阻塞</b>、<b>只能亲缘进程（匿名管道）</b>。',
    },
    all: {
      cap:
        '三条信道并列：共享内存<b>最快</b>但要同步；消息传递<b>最通用</b>（可跨机器）；管道最<b>简单</b>但只能半双工、且常限于亲缘进程。',
      hint: '按速度排：<b>共享内存 &gt; 管道 &gt; 消息队列</b>（一般情形）。',
    },
  };

  const g1 = [shm, shmLb, shmNote, shmA, shmB, ...shmData];
  const g2 = [boxA, boxB, boxALb, boxBLb, msgNote, ...msgs];
  const g3 = [pipe, pipeLb, ...pipeBytes];

  let mode = 'all';
  const apply = (key) => {
    mode = key;
    g1.forEach((o) => (o.visible = key === 'all' || key === 'shm'));
    g2.forEach((o) => (o.visible = key === 'all' || key === 'msg'));
    g3.forEach((o) => (o.visible = key === 'all' || key === 'pipe'));
    host.cap(NOTES[key].cap);
    host.hint(NOTES[key].hint);
  };

  const btns = host.toolbar([
    { label: '全部', active: true, onClick: (b) => (pick(b), apply('all')) },
    { label: '共享内存', onClick: (b) => (pick(b), apply('shm')) },
    { label: '消息传递', onClick: (b) => (pick(b), apply('msg')) },
    { label: '管道', onClick: (b) => (pick(b), apply('pipe')) },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  apply('all');

  /* ---------------------------------------------------------------- 每帧 */
  host.onTick((t) => {
    // ① 共享内存：两个数据块在存储区里来回搬
    shmData.forEach((s, i) => {
      if (!s.visible) return;
      const u = (Math.sin(t * 1.5 + i * Math.PI) + 1) / 2;
      s.position.set(-2.0 + u * 4.0, 1.35 + Math.sin(t * 2 + i) * 0.12, Z1 + (i ? 0.45 : -0.45));
    });
    if (shm.visible) shm.material.opacity = 0.36 + Math.sin(t * 2.2) * 0.08;

    // ② 消息：从发送信箱流向接收信箱
    msgs.forEach((s, i) => {
      if (!s.visible) return;
      const u = ((t * 0.55 + i * 0.34) % 1);
      s.position.set(-3.3 + u * 6.6, 1.3 + Math.sin(u * Math.PI) * 0.55, Z2);
      s.scale.setScalar(0.8 + u * 0.5);
    });

    // ③ 管道：字节沿管道单向流动
    pipeBytes.forEach((s, i) => {
      if (!s.visible) return;
      const u = ((t * 0.42 + i * 0.25) % 1);
      s.position.set(-5.6 + u * 11.2, 1.4, Z3);
    });

    [A, B].forEach((o, i) => {
      o.m.material.emissiveIntensity = 0.12 + Math.sin(t * 1.8 + i * 1.4) * 0.05;
    });
  });
}
