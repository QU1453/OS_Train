/**
 * ch2-map.js —— 2.4.5 第 2 章知识框架（本章小结）
 *
 * 中心一个「进程与线程」核心，四条主线悬浮四周：
 *   进程与线程 → 处理机调度 → 同步与互斥 → 死锁
 * 点按钮逐个聚焦，其余主线变暗；聚焦时该支的要点依次浮起。
 */
import { THREE, SceneHost, textSprite, box, sphere, arrow, grid } from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0, 11.2, 17.2],
    target: [0, 0.6, 0],
    minDist: 12,
    maxDist: 48,
    maxPolarAngle: Math.PI * 0.48,
    label: '第 2 章知识框架',
  });
  const p = host.p;
  host.scene.add(grid(38));

  /* ---------------------------------------------------------------- 核心 */
  const core = box(2.7, 1.15, 2.7, p.accent, {
    emissive: p.accent,
    emissiveIntensity: 0.3,
    roughness: 0.35,
    pos: [0, 0.95, 0],
  });
  host.scene.add(core);

  const coreLb = textSprite('进程与线程', { color: '#FFFFFF', bg: p.accent, border: p.accent, height: 0.62 });
  coreLb.position.set(0, 1.88, 0);
  host.scene.add(coreLb);

  const coreSub = textSprite('第 2 章 · 全书分值最高', { color: p.text2, height: 0.4 });
  coreSub.position.set(0, 2.55, 0);
  host.scene.add(coreSub);

  /* ---------------------------------------------------------------- 分支 */
  const BR = [
    {
      key: 'proc',
      title: '2.1 进程与线程',
      color: p.def,
      x: -5.5,
      z: -3.0,
      kids: [
        '实体 = 程序 + 数据 + PCB（唯一标志）',
        '五状态：创建·就绪·运行·阻塞·终止',
        '线程＝调度单位，进程＝资源单位',
      ],
      cap:
        '<b>状态线是根</b>：就绪→运行靠<b>调度</b>；运行→就绪靠<b>时间片到/被抢占</b>；运行→阻塞靠<b>请求资源或 I/O</b>；阻塞→就绪靠<b>资源到位</b>。',
      hint: '不可能发生的转换：<b>就绪→阻塞</b>、<b>阻塞→运行</b>。PCB 是进程存在的<b>唯一标志</b>。',
    },
    {
      key: 'sched',
      title: '2.2 处理机调度',
      color: p.memo,
      x: 5.5,
      z: -3.0,
      kids: [
        '三级调度：高级 / 中级 / 低级（最频繁）',
        'FCFS·SJF·HRRN·RR·多级反馈队列',
        '评价：周转、带权周转、等待、响应',
      ],
      cap:
        '<b>调度线记三件事</b>：谁对谁有利（FCFS 利长作业、SJF 平均周转最短）、谁会被饿死（SJF 饿死长作业）、<b>什么时候不能调度</b>。',
      hint: '不能调度：<b>处理中断的过程中</b>、进程在<b>内核临界区</b>中。HRRN 响应比＝(等待＋服务)/服务。',
    },
    {
      key: 'sync',
      title: '2.3 同步与互斥',
      color: p.key,
      x: -5.5,
      z: 3.6,
      kids: [
        '临界区四原则：空闲让进·忙则等待',
        '　　　　　　　　有限等待·让权等待',
        'P/V 次序：资源信号量先 P，mutex 后 P',
      ],
      cap:
        '<b>同步线看两处</b>：信号量的<b>次序</b>与三类<b>经典问题</b>。生产者-消费者若先 P(mutex) 再 P(empty)，缓冲区满时<b>占着锁等资源</b>→ 死锁。',
      hint: 'Peterson 与硬件方法都<b>不满足让权等待</b>（忙等）；记录型信号量满足。哲学家：<b>奇偶反序拿</b>或最多 4 人。',
    },
    {
      key: 'dead',
      title: '2.4 死锁',
      color: p.exam,
      x: 5.5,
      z: 3.6,
      kids: [
        '四必要条件「互不请循」，必要非充分',
        '预防：有序分配破循环，一次性申请破请求并保持',
        '避免：银行家算法 · 检测与解除',
      ],
      cap:
        '<b>死锁线四层递进</b>：<b>预防</b>（静态破坏条件，保守）→ <b>避免</b>（动态判安全态）→ <b>检测与解除</b>（放任后收拾）→ 鸵鸟策略。',
      hint: '最易错：<b>资源有序分配法破坏的是「循环等待」</b>；<b>破坏互斥一般不采用</b>；四条件<span>是必要不是充分</span>。',
    },
  ];

  const nodes = BR.map((b) => {
    const g = new THREE.Group();
    host.scene.add(g);
    const panel = box(5.2, 0.9, 2.9, b.color, {
      opacity: 0.82,
      emissive: b.color,
      emissiveIntensity: 0.12,
      roughness: 0.45,
      pos: [b.x, 0.95, b.z],
    });
    g.add(panel);

    const title = textSprite(b.title, { color: p.text1, height: 0.58 });
    title.position.set(b.x, 1.68, b.z);
    g.add(title);

    const kids = b.kids.map((s, i) => {
      const sp = textSprite(s, { color: p.text2, height: 0.38 });
      sp.position.set(b.x + (b.x > 0 ? 0.45 : -0.45), 2.4 + i * 0.6, b.z);
      sp.material.opacity = 0;
      g.add(sp);
      return sp;
    });

    const link = arrow(
      new THREE.Vector3(b.x * 0.25, 0.95, b.z * 0.25),
      new THREE.Vector3(b.x * 0.7, 0.95, b.z * 0.7),
      b.color,
      { headR: 0.11, opacity: 0.55 },
    );
    host.scene.add(link);

    const stem = box(0.1, 0.9, 0.1, b.color, { opacity: 0.4, emissive: b.color, pos: [b.x, 1.25, b.z] });
    g.add(stem);

    return { b, g, panel, title, kids, link };
  });

  /* ------------------------------------------------------------ 光点装饰 */
  const orbit = [];
  for (let i = 0; i < 16; i += 1) {
    const s = sphere(0.075, p.line2, { seg: 12 });
    host.scene.add(s);
    orbit.push(s);
  }

  /* ---------------------------------------------------------------- 状态 */
  let focus = null;

  const apply = (key) => {
    focus = key;
    nodes.forEach((n) => {
      const on = !key || n.b.key === key;
      n.panel.material.opacity = on ? 0.82 : 0.16;
      n.panel.material.emissiveIntensity = on ? 0.16 : 0.03;
      n.title.material.opacity = on ? 1 : 0.3;
      n.kids.forEach((s) => (s.material.opacity = on && key ? 1 : 0));
      n.g.userData.on = on;
    });
    if (!key) {
      host.cap('<b>四条主线</b>：进程与线程 → 处理机调度 → 同步与互斥 → 死锁。点上方按钮逐个聚焦，把散点串成框架。');
      host.hint('复习第 2 章抓三条线：<b>状态线</b>、<b>调度线</b>、<b>同步线</b>；死锁再补「四条件 + 四策略」。');
    } else {
      const n = nodes.find((x) => x.b.key === key);
      host.cap(n.b.cap);
      host.hint(n.b.hint);
    }
  };

  const LABELS = ['总览', '2.1 进程与线程', '2.2 调度', '2.3 同步互斥', '2.4 死锁'];
  const KEYS = [null, 'proc', 'sched', 'sync', 'dead'];
  let btns = [];
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));
  btns = host.toolbar(
    LABELS.map((label, i) => ({
      label,
      active: i === 0,
      onClick: (b) => {
        pick(b);
        apply(KEYS[i]);
      },
    })),
  );

  apply(null);

  /* ---------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    const k = Math.min(1, dt * 3.4);
    nodes.forEach((n, i) => {
      const on = n.g.userData.on !== false;
      const lift = on ? Math.sin(t * 1.5 + i) * 0.09 : -0.25;
      n.panel.position.y += (0.95 + lift - n.panel.position.y) * k;
      n.title.position.y += (1.68 + lift - n.title.position.y) * k;
      n.kids.forEach((s, j) => {
        const base = 2.4 + j * 0.6 + (focus ? Math.sin(t * 1.2 + j * 0.7) * 0.05 : 0);
        s.position.y += (base + lift - s.position.y) * k;
      });
    });

    core.rotation.y += dt * 0.26;
    coreLb.material.opacity = 0.92 + Math.sin(t * 2.4) * 0.08;

    orbit.forEach((s, i) => {
      const a = t * 0.45 + (i / orbit.length) * Math.PI * 2;
      const r = 10.0 + Math.sin(t * 0.7 + i) * 0.55;
      s.position.set(Math.cos(a) * r, 0.55 + Math.sin(t * 1.1 + i) * 0.35, Math.sin(a) * r);
    });
  });
}
