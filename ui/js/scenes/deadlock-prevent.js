/**
 * deadlock-prevent.js —— 2.4.2 死锁预防
 *
 * 四种视角：
 *   ① 四把锤子：四条柱子＝四个必要条件，砸掉任一条即防住死锁
 *   ② 有序分配：资源按编号排成台阶，只准向上要，环接不起来
 *   ③ 四种对比：破坏条件 / 主要方法 / 可行性代价
 *   ④ 真题四问：最易混淆的四组对应关系
 */
import { THREE, SceneHost, textSprite, retext, box, sphere, arrow, grid, line, easeInOut, clamp01, lerp } from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0.4, 11.4, 17.6],
    target: [0, 1.6, 0],
    minDist: 13,
    maxDist: 48,
    maxPolarAngle: Math.PI * 0.48,
    label: '死锁预防：破坏四个必要条件',
  });
  const p = host.p;
  host.scene.add(grid(42));

  const C = (color, height = 0.3) => ({ color, height });
  const lbl = (text, x, y, z, color, height = 0.32) => {
    const s = textSprite(text, C(color, height));
    s.position.set(x, y, z);
    host.scene.add(s);
    return s;
  };
  const cardBg = (g, x, y, w, h, col) => {
    const bg = box(w, h, 0.12, p.surface, { edges: true, edgeColor: col, pos: [x, y, 0] });
    g.add(bg);
    return bg;
  };
  /* scale.x 做左对齐：贴着左边界摆放 */
  const cellLeft = (g, text, xLeft, y, color, height = 0.3) => {
    const s = textSprite(text, C(color, height));
    s.position.set(xLeft + s.scale.x / 2, y, 0.14);
    g.add(s);
    return s;
  };
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

  /* ============================================== ① 四把锤子 gFour */
  const gFour = new THREE.Group();
  host.scene.add(gFour);

  gFour.add(lbl('① 破坏法：砸掉任意一个条件，死锁就无从产生', 0, 6.3, 0, p.def, 0.46));

  const colX = [-7.5, -2.5, 2.5, 7.5];
  const condCol = [p.err, p.warn, p.key, p.def];
  const condName = ['① 互斥', '② 不可剥夺', '③ 请求并保持', '④ 循环等待'];
  const condWay = [
    'SPOOLing 改成可共享',
    '不满足就释放 · 或强行剥夺',
    '一次性申请 · 或逐步释放',
    '按编号 1→2→3 递增申请',
  ];
  const cols = [];
  const colTx = [];
  colX.forEach((x, i) => {
    const c = box(1.95, 3.3, 1.95, condCol[i], {
      opacity: 0.95, edgeColor: condCol[i], edgeOpacity: 0.4,
      emissive: condCol[i], emissiveIntensity: 0.12, pos: [x, 2.05, 0],
    });
    cols.push(c);
    gFour.add(c);
    const n = lbl(condName[i], x, 4.25, 0, condCol[i], 0.4);
    colTx.push(n);
    gFour.add(n);
    gFour.add(lbl(condWay[i], x, 0.08, 1.2, p.text2, 0.28));
  });

  /* 锤子：锤头为轴心，手柄向上 */
  const hammer = new THREE.Group();
  hammer.add(box(1.25, 0.6, 0.68, p.text3, { emissive: p.key, emissiveIntensity: 0.3 }));
  hammer.add(box(0.17, 1.5, 0.17, p.key, { pos: [0, 1.02, 0] }));
  hammer.position.set(colX[0], 5.7, 0);
  gFour.add(hammer);

  gFour.add(lbl('四条同时成立才可能死锁 → 破坏其一即可', 0, -0.8, 0, p.ok, 0.32));

  /* ============================================ ② 有序分配 gOrder */
  const gOrder = new THREE.Group();
  host.scene.add(gOrder);

  gOrder.add(lbl('② 资源有序分配法：只准往高处要，环就接不起来', 0, 6.3, 0, p.memo, 0.44));

  const stepX = [-5.2, 0, 5.2];
  const stepY = [1.0, 2.0, 3.0];
  const stepName = ['R1 打印机 #1', 'R2 扫描仪 #2', 'R3 刻录机 #3'];
  stepX.forEach((x, i) => {
    const slab = box(4.3, 0.5, 2.8, p.surface, {
      edgeColor: p.memo, edgeOpacity: 0.5, emissive: p.memo, emissiveIntensity: 0.06,
      pos: [x, stepY[i], 0],
    });
    gOrder.add(slab);
    const legH = Math.max(0.2, stepY[i] - 0.25);
    gOrder.add(box(1.05, legH, 1.05, p.line2, { edges: false, pos: [x, legH / 2, 0] }));
    gOrder.add(lbl(stepName[i], x, stepY[i], 1.6, p.text2, 0.28));
  });

  const upArrows = [];
  for (let i = 0; i < 2; i += 1) {
    const a = arrow(
      V(stepX[i] + 1.75, stepY[i] + 0.42, 0),
      V(stepX[i + 1] - 1.75, stepY[i + 1] + 0.42, 0),
      p.memo,
      { headLen: 0.3, headR: 0.1, opacity: 0.85 },
    );
    upArrows.push(a);
    gOrder.add(a);
  }

  /* 禁止回头（虚线 + 叉） */
  gOrder.add(line([V(4.7, 4.15, 0), V(-4.7, 4.15, 0)], p.err, { opacity: 0.55, dash: 0.24, gap: 0.16 }));
  gOrder.add(line([V(-0.55, 3.8, 0), V(0.55, 4.55, 0)], p.err, { opacity: 0.95, dash: 0.4, gap: 0 }));
  gOrder.add(line([V(0.55, 3.8, 0), V(-0.55, 4.55, 0)], p.err, { opacity: 0.95, dash: 0.4, gap: 0 }));
  gOrder.add(lbl('✕ 编号只增不减：已到 R3 就永远不能再要 R1', 0, 5.05, 0, p.err, 0.34));

  const ball = sphere(0.3, p.accent, { emissive: p.accent, emissiveIntensity: 0.7 });
  ball.position.set(stepX[0], stepY[0] + 0.6, 0);
  gOrder.add(ball);

  gOrder.add(lbl('所有申请同向朝上 → 不可能首尾相接 → 无环 → 无死锁', 0, -0.8, 0, p.ok, 0.32));

  /* =============================================== ③ 对比表 gTbl */
  const gTbl = new THREE.Group();
  host.scene.add(gTbl);

  gTbl.add(lbl('③ 四种破坏方式对比', 0, 6.1, 0, p.key, 0.46));

  const tCol = [-6.4, 0.2, 6.6];
  const tW = [-2.6, -0.4, 2.6];
  const head = ['破坏条件', '主要方法', '可行性 / 代价'];
  head.forEach((h, i) => gTbl.add(lbl(h, tCol[i], 5.15, 0, [p.text1, p.memo, p.warn][i], 0.4)));

  const rows = [
    ['互斥', '改造成可共享资源（SPOOLing）', '受物理特性限制 · 一般不采用', p.err],
    ['不可剥夺', '不满足就释放已占，或强行剥夺', '开销大 · 仅适用可恢复资源', p.warn],
    ['请求并保持', '一次性申请 或 逐步释放', '简单 · 利用率低 · 可能饥饿', p.key],
    ['循环等待', '资源有序分配法（编号递增）', '较实用 · 限制新设备 · 编程不便', p.def],
  ];
  rows.forEach((r, i) => {
    const y = 4.25 - i * 1.25;
    gTbl.add(lbl(r[0], tCol[0], y, 0, r[3], 0.34));
    cellLeft(gTbl, r[1], tCol[1] + tW[1], y, p.text1, 0.3);
    cellLeft(gTbl, r[2], tCol[2] + tW[2], y, p.text2, 0.28);
    gTbl.add(line([V(-7.8, y - 0.62, 0), V(7.8, y - 0.62, 0)], 0x9AA6B4, { opacity: 0.32, dash: 0.22, gap: 0.16 }));
  });

  gTbl.add(lbl('预防太保守（限制过严、利用率低）→ 实际多用「避免」或「检测与解除」', 0, -0.85, 0, p.ok, 0.32));

  /* ============================================= ④ 真题四问 gExam */
  const gExam = new THREE.Group();
  host.scene.add(gExam);

  gExam.add(lbl('④ 真题最爱问的四组对应', 0, 6.0, 0, p.exam, 0.46));

  const qa = [
    ['死锁预防的基本思想是什么？', '破坏四个必要条件中的任意一个', p.def],
    ['资源有序分配法破坏哪个条件？', '循环等待（最易错，不是请求并保持）', p.err],
    ['一次性申请全部资源破坏哪个？', '请求并保持', p.key],
    ['哪种死锁预防方法一般不采用？', '破坏互斥条件', p.warn],
  ];
  qa.forEach((it, i) => {
    const x = i % 2 === 0 ? -4.35 : 4.35;
    const y = i < 2 ? 3.35 : 0.55;
    cardBg(gExam, x, y, 8.1, 2.15, it[2]);
    gExam.add(lbl(it[0], x, y + 0.5, 0.14, p.text2, 0.3));
    gExam.add(lbl(it[1], x, y - 0.38, 0.14, it[2], 0.34));
  });

  gExam.add(lbl('预防＝静态限制，避免＝动态判断，检测解除＝放任后收拾', 0, -1.05, 0, p.text2, 0.3));

  /* ==================================================== 交互与动画 */
  const NOTES = {
    four: '四个必要条件<strong>缺一不可</strong>：砸掉任意一条柱子，死锁就建不起来。',
    order: '有序分配法把资源编号排成台阶，申请<strong>只能往上走</strong>，环自然接不起来。',
    tbl: '四条路各自有代价：互斥一般不采用、剥夺开销大、预分配利用率低、有序分配限制新设备。',
    exam: '最高频的坑：<strong>资源有序分配法破坏的是「循环等待」</strong>，不是请求并保持。',
  };
  /* 精灵用 canvas 绘制，无法解析 HTML，需先剥标签 */
  const plain = (s) => s.replace(/<[^>]+>/g, '');
  const note = textSprite(plain(NOTES.four), C(p.text2, 0.32));
  note.position.set(0, -1.55, 0);
  host.scene.add(note);

  const apply = (key) => {
    gFour.visible = key === 'four';
    gOrder.visible = key === 'order';
    gTbl.visible = key === 'tbl';
    gExam.visible = key === 'exam';
    retext(note, plain(NOTES[key]), C(p.text2, 0.32));
    host.cap(`<b>死锁预防</b> —— ${NOTES[key]}`);
  };

  let btns = [];
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));
  btns = host.toolbar([
    { label: '砸条件', active: true, onClick: () => { apply('four'); pick(btns[0]); } },
    { label: '有序分配', onClick: () => { apply('order'); pick(btns[1]); } },
    { label: '四种对比', onClick: () => { apply('tbl'); pick(btns[2]); } },
    { label: '真题四问', onClick: () => { apply('exam'); pick(btns[3]); } },
  ]);

  host.hint('口诀：<b>破其一即可</b>；有序分配破<u>循环等待</u>，一次性申请破<u>请求并保持</u>，破坏互斥<u>一般不采用</u>。');

  /* 状态缓存：避免每帧重建贴图 */
  let lastIdx = -1;
  let lastCap = '';
  const broken = [0, 0, 0, 0];

  host.onTick((t, dt) => {
    /* ① 锤子逐条砸 */
    if (gFour.visible) {
      const T = 18;
      const u = (((t % T) + T) % T) / T;
      const q = u * 4;
      const idx = Math.min(3, Math.floor(q));
      const f = q - idx;

      /* 落锤：0.14~0.42 下砸，0.42~0.60 停顿，0.60~1 抬起并滑向下一根 */
      let drop = 0;
      if (f >= 0.14 && f < 0.42) drop = (f - 0.14) / 0.28;
      else if (f >= 0.42 && f < 0.6) drop = 1;
      else if (f >= 0.6) drop = 1 - (f - 0.6) / 0.4;
      const e = easeInOut(clamp01(drop));

      const here = colX[idx];
      const next = colX[(idx + 1) % 4];
      const slide = f >= 0.6 ? easeInOut((f - 0.6) / 0.4) : 0;
      hammer.position.set(lerp(here, next, slide), lerp(5.7, 4.3, e), 0);
      hammer.rotation.z = lerp(-0.5, 0, e);

      /* 已砸倒：0..brokenUpTo */
      const upTo = f >= 0.42 ? idx : idx - 1;
      for (let j = 0; j < 4; j += 1) {
        const target = j <= upTo ? 1 : 0;
        broken[j] = lerp(broken[j], target, Math.min(1, dt * 7));
        const b = broken[j];
        cols[j].material.opacity = 0.95 - b * 0.6;
        cols[j].material.emissiveIntensity = 0.12 + b * 0.35;
        cols[j].scale.y = 1 - b * 0.12;
        cols[j].position.y = 2.05 - b * 0.2;
        colTx[j].position.y = 4.25 - b * 0.4;
      }

      if (upTo !== lastIdx) {
        lastIdx = upTo;
        for (let j = 0; j < 4; j += 1) {
          const ok = j <= upTo;
          retext(colTx[j], ok ? `${condName[j]} ✕` : condName[j], C(ok ? p.text3 : condCol[j], 0.4));
        }
      }

      const cap = upTo < 0
        ? '锤子落下前：<b>四条柱子同时立着</b>，死锁才可能发生。'
        : `抽掉「<b>${condName[upTo]}</b>」→ 该条件不再成立 → 死锁不可能发生。`;
      if (cap !== lastCap) {
        lastCap = cap;
        host.cap(`<b>死锁预防</b> —— ${cap}`);
      }
    }

    /* ② 小球沿台阶向上爬 */
    if (gOrder.visible) {
      const T = 13;
      const u = (((t % T) + T) % T) / T;
      let bx = stepX[0];
      let by = stepY[0] + 0.6;
      let hop = 0;
      if (u >= 0.24 && u < 0.42) {
        const k = easeInOut((u - 0.24) / 0.18);
        bx = lerp(stepX[0], stepX[1], k);
        by = lerp(stepY[0], stepY[1], k) + 0.6;
        hop = Math.sin(Math.PI * k) * 0.55;
      } else if (u >= 0.42 && u < 0.62) {
        bx = stepX[1];
        by = stepY[1] + 0.6;
      } else if (u >= 0.62 && u < 0.8) {
        const k = easeInOut((u - 0.62) / 0.18);
        bx = lerp(stepX[1], stepX[2], k);
        by = lerp(stepY[1], stepY[2], k) + 0.6;
        hop = Math.sin(Math.PI * k) * 0.55;
      } else if (u >= 0.8) {
        bx = stepX[2];
        by = stepY[2] + 0.6;
      }
      ball.position.set(bx, by + hop, 0);
      ball.material.emissiveIntensity = 0.55 + Math.sin(t * 3) * 0.22;

      upArrows.forEach((a, i) => {
        const on = i === 0 ? u >= 0.24 && u < 0.46 : u >= 0.62 && u < 0.84;
        a.children.forEach((o) => {
          if (o.material) o.material.opacity = on ? 0.95 : 0.4;
        });
      });
    }

    /* ③ 表格行轻微呼吸 */
    if (gTbl.visible) {
      const k = 0.84 + Math.sin(t * 1.7) * 0.16;
      gTbl.children.forEach((o) => {
        if (o.isSprite) o.material.opacity = k;
      });
    }

    /* ④ 卡片脉冲 */
    if (gExam.visible) {
      gExam.children.forEach((o, i) => {
        if (o.isSprite) o.material.opacity = 0.82 + Math.sin(t * 2 + i * 0.7) * 0.18;
      });
    }
  });

  host.onDispose(() => {
    host.scene.traverse((o) => {
      if (o.material && o.material.map && o.material.map.dispose) o.material.map.dispose();
    });
  });

  apply('four');
}
