/**
 * reader-writer.js —— 读者-写者问题（2.3.6）
 *
 * 规则：读者可同时读（共享），写者必须独占（互斥），读写不能并行。
 * 三个信号量的分工（考试就考这一句）：
 *   rw    = 1  写锁：写者 P/V 它；读者里「第一个」也要 P 它、「最后一个」V 它
 *   mutex = 1  保护 count 这个共享变量
 *   count = 0  当前在读的读者数
 */
import {
  THREE,
  SceneHost,
  textSprite,
  retext,
  box,
  sphere,
  grid,
} from './_runtime.js';

const ramp = (u, a, b) => Math.max(0, Math.min(1, (u - a) / (b - a)));
const win = (u, a, b, c, d) => Math.min(ramp(u, a, b), 1 - ramp(u, c, d));

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [1.0, 10.2, 17.0],
    target: [0, 1.4, 0],
    minDist: 13,
    maxDist: 46,
    maxPolarAngle: Math.PI * 0.48,
    label: '读者-写者问题',
  });
  const p = host.p;
  host.scene.add(grid(34));

  const C = (color, height = 0.3) => ({ color, height });

  /* ------------------------------------------------------- 共享资源 */
  const db = box(2.7, 0.75, 2.7, p.def, {
    opacity: 0.6, emissive: p.def, emissiveIntensity: 0.12, pos: [0, 0.6, 0],
  });
  host.scene.add(db);
  const dbLb = textSprite('共享文件 / 数据库', C(p.text1, 0.3));
  dbLb.position.set(0, 1.15, 0);
  host.scene.add(dbLb);

  const countLb = textSprite('count = 0', C(p.key, 0.36));
  countLb.position.set(0, 3.25, 0);
  host.scene.add(countLb);
  const rwLb = textSprite('rw = 1（写锁空闲）', C(p.ok, 0.34));
  rwLb.position.set(0, 2.6, 0);
  host.scene.add(rwLb);
  const stateLb = textSprite('空闲：谁都能读，也能写', C(p.text2, 0.3));
  stateLb.position.set(0, -1.0, 0);
  host.scene.add(stateLb);

  /* --------------------------------------------------- 读者 / 写者 */
  const gPlates = new THREE.Group();
  host.scene.add(gPlates);

  const orbit = (i) => new THREE.Vector3(Math.cos(i * 2.1) * 2.35, 1.0, Math.sin(i * 2.1) * 2.35);
  const home = [
    new THREE.Vector3(-6.4, 0.5, -2.9),
    new THREE.Vector3(-6.4, 0.5, 0),
    new THREE.Vector3(-6.4, 0.5, 2.9),
  ];
  const wHome = new THREE.Vector3(6.4, 0.5, 0);

  const readers = [];
  for (let i = 0; i < 3; i++) {
    const pl = box(2.1, 0.4, 1.3, p.key, {
      opacity: 0.5, emissive: p.key, emissiveIntensity: 0.1, pos: [home[i].x, 0.5, home[i].z],
    });
    gPlates.add(pl);
    const lb = textSprite(`读者 R${i + 1}`, C(p.text2, 0.28));
    lb.position.set(home[i].x, 0.86, home[i].z + (home[i].z < 0 ? -0.55 : 0.55));
    gPlates.add(lb);

    const ball = sphere(0.23, p.key, { emissive: p.key, emissiveIntensity: 0.9 });
    host.scene.add(ball);
    readers.push({ pl, lb, ball, home: home[i] });
  }

  const wPl = box(2.1, 0.4, 1.3, p.err, {
    opacity: 0.5, emissive: p.err, emissiveIntensity: 0.1, pos: [wHome.x, 0.5, 0],
  });
  gPlates.add(wPl);
  const wLb = textSprite('写者 W', C(p.text2, 0.28));
  wLb.position.set(wHome.x, 0.86, 0.55);
  gPlates.add(wLb);
  const wBall = sphere(0.26, p.err, { emissive: p.err, emissiveIntensity: 0.95 });
  host.scene.add(wBall);

  /* -------------------------------------------- 计数器演示 gCount */
  const gCount = new THREE.Group();
  host.scene.add(gCount);
  const STEPS = [
    ['① 第一个读者', 'P(mutex); count++; 若 count==1 → P(rw); V(mutex)'],
    ['② 后来者直接进', 'count 从 1 涨到 3，只动 mutex，不再碰 rw'],
    ['③ 最后一个离开', 'count--; 若 count==0 → V(rw) 交还写锁'],
    ['④ 写者才能进', 'P(rw) 成功即独占；用完 V(rw)'],
  ];
  const stepCards = STEPS.map((s, i) => {
    const x = -6.5 + i * 4.33;
    const bg = box(4.05, 2.1, 0.12, p.surface, { edges: true, edgeColor: p.line2, pos: [x, 0.95, 4.3] });
    gCount.add(bg);
    const t = textSprite(s[0], C(p.key, 0.34));
    t.position.set(x, 1.55, 4.4);
    gCount.add(t);
    const d = textSprite(s[1], C(p.text2, 0.24));
    d.position.set(x, 0.82, 4.4);
    gCount.add(d);
    return bg;
  });

  /* --------------------------------------------- 策略对比 gPolicy */
  const gPolicy = new THREE.Group();
  host.scene.add(gPolicy);
  const POL = [
    ['读者优先', '读者源源不断 → 写者可能饿死', p.key],
    ['写者优先', '写者一到就封锁新读者 → 读者可能饿死', p.err],
    ['公平（FIFO）', '按到达顺序放行，读写都不饿死（实现最复杂）', p.ok],
  ];
  const polCards = POL.map((c, i) => {
    const x = -6.2 + i * 6.2;
    const bg = box(5.6, 2.6, 0.12, p.surface, { edges: true, edgeColor: c[2], pos: [x, 1.6, 3.6] });
    gPolicy.add(bg);
    const t = textSprite(c[0], C(c[2], 0.42));
    t.position.set(x, 2.25, 3.72);
    gPolicy.add(t);
    const d = textSprite(c[1], C(p.text2, 0.28));
    d.position.set(x, 1.55, 3.72);
    gPolicy.add(d);
    const bar = box(4.6, 0.16, 0.3, c[2], { pos: [x, 0.85, 3.72] });
    gPolicy.add(bar);
    return bar;
  });

  /* ---------------------------------------------------------- 模式 */
  const NOTES = {
    share: '读者共享：三人同时读，count = 3，写锁 rw 被第一个读者拿走 → 写者只能等。',
    excl: '写者独占：写者一进来 rw = 0，所有读者都卡在 P(rw) 上排队。',
    count: 'count 和 rw 的联动是唯一难点：第一个读者加锁，最后一个读者解锁。',
    policy: '三种策略的差别只在于「谁来排队、谁先被放行」，都靠信号量实现。',
  };
  const note = textSprite(NOTES.share, C(p.text2, 0.32));
  note.position.set(0, -1.75, 0);
  host.scene.add(note);

  let cur = 'share';
  const apply = (key) => {
    cur = key;
    gCount.visible = key === 'count';
    gPolicy.visible = key === 'policy';
    gPlates.visible = key !== 'count';
    retext(note, NOTES[key], C(p.text2, 0.32));
    host.cap(`<b>${
      key === 'share' ? '读者共享' : key === 'excl' ? '写者独占'
        : key === 'count' ? 'count 与 rw 的联动' : '三种优先级策略'
    }</b> —— ${NOTES[key]}`);
  };

  const btns = host.toolbar([
    { label: '读者共享', active: true, onClick: () => { apply('share'); pick(btns[0]); } },
    { label: '写者独占', onClick: () => { apply('excl'); pick(btns[1]); } },
    { label: '计数器联动', onClick: () => { apply('count'); pick(btns[2]); } },
    { label: '三种策略', onClick: () => { apply('policy'); pick(btns[3]); } },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  host.hint('口诀：<b>第一个读者加写锁，最后一个读者放写锁</b>；中间的读者只登记 count。');
  apply('share');

  /* --------------------------------------------------------- 动画 */
  const put = (ball, from, to, k, col) => {
    ball.position.set(
      from.x + (to.x - from.x) * k,
      0.5 + 0.5 * k,
      from.z + (to.z - from.z) * k,
    );
    ball.material.color.set(col);
  };

  host.onTick((t) => {
    const key = cur;

    if (key === 'share' || key === 'excl') {
      const share = key === 'share';
      readers.forEach((r, i) => {
        if (share) {
          r.ball.position.set(
            Math.cos(t * 0.9 + i * 2.1) * 2.35,
            0.95 + Math.sin(t * 2.2 + i) * 0.08,
            Math.sin(t * 0.9 + i * 2.1) * 2.35,
          );
          r.ball.material.color.set(p.key);
          r.pl.material.opacity = 0.3;
        } else {
          const jit = Math.sin(t * 7 + i) * 0.05;
          r.ball.position.set(r.home.x + jit, 0.85, r.home.z);
          r.ball.material.color.set(p.err);
          r.pl.material.opacity = 0.6;
          r.pl.material.emissiveIntensity = 0.35;
        }
      });
      if (share) {
        wBall.position.set(6.4 + Math.sin(t * 5) * 0.04, 0.85, 0);
        wBall.material.color.set(p.warn);
        wPl.material.opacity = 0.6;
        wPl.material.emissiveIntensity = 0.35;
        retext(countLb, 'count = 3', C(p.key, 0.36));
        retext(rwLb, 'rw = 0（写锁被读者持有）', C(p.err, 0.34));
        retext(stateLb, '三个读者同时读，写者在门外排队（可能饿死）', C(p.warn, 0.3));
        db.material.emissiveIntensity = 0.35;
      } else {
        wBall.position.set(
          Math.cos(t * 1.5) * 1.65,
          1.0 + Math.sin(t * 2.6) * 0.08,
          Math.sin(t * 1.5) * 1.65,
        );
        wBall.material.color.set(p.err);
        retext(countLb, 'count = 0', C(p.text3, 0.36));
        retext(rwLb, 'rw = 0（写者独占中）', C(p.err, 0.34));
        retext(stateLb, '写者在写，所有读者 P(rw) 阻塞', C(p.err, 0.3));
        db.material.emissiveIntensity = 0.55;
      }
      return;
    }

    if (key === 'count') {
      const T = 17;
      const u = ((t % T) + T) % T / T;
      const k = [
        win(u, 0.16, 0.26, 0.66, 0.74),
        win(u, 0.34, 0.44, 0.78, 0.86),
        win(u, 0.50, 0.60, 0.86, 0.93),
      ];
      const kw = win(u, 0.93, 0.99, 1.2, 1.4);
      readers.forEach((r, i) => {
        const o = orbit(i);
        put(r.ball, new THREE.Vector3(r.home.x, 0.5, r.home.z), o, k[i], k[i] > 0.5 ? p.key : p.text3);
      });
      put(wBall, new THREE.Vector3(wHome.x, 0.5, 0), new THREE.Vector3(0, 1.0, 0), kw, kw > 0.5 ? p.ok : p.err);

      const n = k.filter((v) => v > 0.5).length;
      retext(countLb, `count = ${n}`, C(n > 0 ? p.key : p.text3, 0.36));
      const locked = n > 0 || kw > 0.5;
      retext(rwLb, locked ? 'rw = 0（被占用）' : 'rw = 1（写锁空闲）', C(locked ? p.err : p.ok, 0.34));
      retext(stateLb,
        n >= 2 ? `${n} 个读者并发读，只登记 count，不重复 P(rw)`
          : n === 1 ? '第一个读者：count 由 0 变 1 → 顺手 P(rw)'
            : kw > 0.5 ? '写者 P(rw) 成功 → 独占；走了要 V(rw)'
              : '没人了：最后一个读者 count 归 0 → V(rw) 交还',
        C(p.text2, 0.3));
      db.material.emissiveIntensity = locked ? 0.5 : 0.12;

      const idx = u < 0.34 ? 0 : u < 0.66 ? 1 : u < 0.93 ? 2 : 3;
      stepCards.forEach((bg, i) => {
        bg.material.emissive.set(i === idx ? p.key : 0x000000);
        bg.material.emissiveIntensity = i === idx ? 0.35 : 0;
      });
      return;
    }

    /* policy：三根条按「放行概率」呼吸，直观表达谁更容易饿死 */
    const ph = t * 1.4;
    polCards[0].scale.x = 0.55 + Math.abs(Math.sin(ph)) * 0.45;
    polCards[1].scale.x = 0.85 - Math.abs(Math.sin(ph)) * 0.35;
    polCards[2].scale.x = 0.8;
    retext(stateLb, '策略只改排队规则，不改「读共享、写独占」这个本质', C(p.text2, 0.3));
    db.material.emissiveIntensity = 0.12;
  });
}
