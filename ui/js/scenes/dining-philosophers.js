/**
 * dining-philosophers.js —— 哲学家进餐问题与死锁（2.3.7）
 *
 * 演示：
 *   · 5 位哲学家 / 5 根筷子围桌而坐，第 i 位哲学家的左筷为 i、右筷为 (i+1) mod 5；
 *   · 错误解法「人人先左后右」：两步操作后形成循环等待 → 死锁；
 *   · 三种解决方案：①限制至多 4 人取筷（P(count)）②成对一次取得（AND 型）
 *     ③资源有序分配（奇偶法：偶数先左、奇数先右）——后两者分别破坏「循环等待」。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  sphere,
  cylinder,
  ring,
  grid,
  arrow,
} from './_runtime.js';

const N = 5; // 哲学家 / 筷子数量

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [0, 8.6, 12.6],
    target: [0, 1.1, 0],
    minDist: 8.5,
    maxDist: 34,
    maxPolarAngle: Math.PI * 0.495,
    autoRotate: true,
    autoRotateSpeed: 0.35,
    label: 'DINING PHILOSOPHERS',
  });
  const p = host.p;
  host.scene.add(grid(24));

  const R_PHIL = 4.5;
  const R_CHOP = 3.05;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const philPos = (i) => new THREE.Vector3(Math.cos(ang(i)) * R_PHIL, 0.98, Math.sin(ang(i)) * R_PHIL);
  const chopAngle = (i) => ang(i) + Math.PI / N;
  const chopPos = (i) => new THREE.Vector3(Math.cos(chopAngle(i)) * R_CHOP, 0.95, Math.sin(chopAngle(i)) * R_CHOP);

  /* --------------------------------------------------------------- 圆桌 */
  const table = cylinder(3.55, 3.7, 0.26, p.surface, {
    emissive: p.line2,
    emissiveIntensity: 0.06,
    roughness: 0.45,
  });
  table.position.set(0, 0.56, 0);
  host.scene.add(table);
  const rim = ring(3.5, 3.72, p.def, { opacity: 0.35 });
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(0, 0.7, 0);
  host.scene.add(rim);

  /* ------------------------------------------------------------ 筷子 */
  const chopMeshes = [];
  for (let i = 0; i < N; i++) {
    const a = chopAngle(i);
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).normalize();
    const rod = cylinder(0.07, 0.07, 1.5, p.line2, { seg: 14, roughness: 0.4 });
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    rod.position.copy(chopPos(i));
    host.scene.add(rod);
    chopMeshes.push({ mesh: rod });
  }
  const chopTitle = textSprite('筷子 chopstick[5]（各 1 根）', {
    color: p.def,
    bg: 'rgba(255,255,255,0.9)',
    border: p.def,
    height: 0.46,
  });
  chopTitle.position.set(0, 2.3, 0);
  host.scene.add(chopTitle);

  /* --------------------------------------------------------- 哲学家球 */
  const phils = [];
  for (let i = 0; i < N; i++) {
    const orb = sphere(0.42, p.def, { emissive: p.def, emissiveIntensity: 0.35 });
    orb.position.copy(philPos(i));
    host.scene.add(orb);
    const lab = textSprite(`P${i} 思考`, { color: p.text1, height: 0.42 });
    lab.position.set(orb.position.x, orb.position.y + 0.86, orb.position.z);
    host.scene.add(lab);
    phils.push({ orb, lab });
  }

  /* ------------------------------------------------------ 循环等待箭头 */
  const cycleGrp = new THREE.Group();
  for (let i = 0; i < N; i++) {
    const av = philPos(i).clone().setY(1.7).lerp(new THREE.Vector3(0, 1.7, 0), 0.2);
    const bv = philPos((i + 1) % N).clone().setY(1.7).lerp(new THREE.Vector3(0, 1.7, 0), 0.2);
    cycleGrp.add(arrow(av, bv, p.warn, { opacity: 0.92, headR: 0.15, headLen: 0.42 }));
  }
  cycleGrp.visible = false;
  host.scene.add(cycleGrp);

  const stateLabel = textSprite('等待开始', { color: p.text2, bg: 'rgba(255,255,255,0.86)', border: p.line2, height: 0.52 });
  stateLabel.position.set(0, 1.5, 0);
  host.scene.add(stateLabel);

  const retext = (sprite, text, opts) => {
    const next = textSprite(text, opts);
    sprite.material.map.dispose();
    sprite.material.map = next.material.map;
    sprite.material.needsUpdate = true;
    sprite.scale.set(next.scale.x, next.scale.y, 1);
    next.material.dispose();
  };

  /* -------------------------------------------------------------- 状态 */
  const chop = new Array(N).fill(null); // 每根筷子的持有者编号
  const phil = Array.from({ length: N }, () => ({ state: 'think', held: [] }));
  let count = 4; // 方案① count 信号量
  let strategy = 'raw'; // raw | limit4 | ordered
  let dead = false;

  const firstChop = (i) => (strategy === 'ordered' && i % 2 === 1 ? (i + 1) % N : i);
  const secondChop = (i) => (strategy === 'ordered' && i % 2 === 1 ? i : (i + 1) % N);

  const STRAT_NAME = {
    raw: '原始（人人先左后右）',
    limit4: '方案① 限制至多 4 人取筷',
    ordered: '方案③ 资源有序分配（奇偶法）',
  };

  const render = () => {
    for (let i = 0; i < N; i++) {
      const st = phil[i];
      const txt =
        st.state === 'think'
          ? '思考'
          : st.state === 'hold1'
            ? `持有筷${st.held[0]}`
            : st.state === 'eat'
              ? '进餐'
              : '阻塞';
      retext(phils[i].lab, `P${i} ${txt}`, { color: p.text1, height: 0.42 });
    }
    const eaters = phil.filter((x) => x.state === 'eat').length;
    const blocked = phil.filter((x) => x.state === 'blocked').length;
    retext(
      stateLabel,
      dead ? '死锁 · 循环等待' : `策略：${STRAT_NAME[strategy]}　进餐 ${eaters} 人 · 阻塞 ${blocked} 人`,
      dead
        ? { color: p.bg0, bg: p.warn, height: 0.52 }
        : { color: p.text2, bg: 'rgba(255,255,255,0.86)', border: p.line2, height: 0.52 }
    );
    cycleGrp.visible = dead;
  };

  const pulse = (btn) => btn && btn.animate && btn.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 260 });

  /* --------------------------------------------------------- 第 1 步取筷 */
  const takeFirst = (btn) => {
    dead = false;
    let got = 0;
    let blocked = 0;
    for (let i = 0; i < N; i++) {
      const st = phil[i];
      if (st.state !== 'think') continue;
      if (strategy === 'limit4') {
        if (count <= 0) {
          st.state = 'blocked';
          blocked++;
          continue;
        }
        count--;
        st.permit = true;
      }
      const c = firstChop(i);
      if (chop[c] === null) {
        chop[c] = i;
        st.held.push(c);
        st.state = 'hold1';
        got++;
      } else {
        st.state = 'blocked';
        blocked++;
      }
    }
    render();
    const dir = strategy === 'ordered' ? '偶数号取左筷、奇数号取右筷，取筷方向彼此相反' : '人人先取自己的左筷';
    host.cap(
      `<b>第 1 步</b>（${STRAT_NAME[strategy]}）：${dir} → <b>${got}</b> 根筷子被拿起${blocked ? `，<b>${blocked}</b> 位哲学家暂时拿不到` : ''}。` +
        (strategy === 'limit4'
          ? ` <i>P(count) 把并发取筷人数限制在 4 人以内。</i>`
          : '')
    );
    pulse(btn);
  };

  /* --------------------------------------------------------- 第 2 步取筷 */
  const takeSecond = (btn) => {
    let eat = 0;
    let blocked = 0;
    for (let i = 0; i < N; i++) {
      const st = phil[i];
      if (st.state !== 'hold1') continue;
      const c = secondChop(i);
      if (chop[c] === null) {
        chop[c] = i;
        st.held.push(c);
        st.state = 'eat';
        eat++;
      } else {
        st.state = 'blocked';
        blocked++;
      }
    }
    // 判断是否死锁：仍有哲学家持有一根筷子的同时等待另一根，且无人能进餐
    const holdersWaiting = phil.filter((x) => x.state === 'blocked' && x.held.length > 0).length;
    dead = eat === 0 && holdersWaiting >= 2;
    render();
    if (dead) {
      host.cap(
        '<b>第 2 步</b>：每位哲学家都<b>请求并保持</b>（手持左筷）再去申请人家的右筷 → ' +
          '<b style="color:var(--sem-warn)">循环等待成立，死锁！</b> <i>互斥、请求与保持、不可剥夺、循环等待四个条件同时满足。</i>'
      );
    } else {
      host.cap(
        `<b>第 2 步</b>：本轮有 <b>${eat}</b> 位哲学家凑齐两根筷子顺利进餐，不存在循环等待 → <b>不会死锁</b>。` +
          (strategy === 'limit4'
            ? ' <i>因为至多 4 人用筷，5 根筷子中必剩 1 根空闲，总有人能凑齐。</i>'
            : ' <i>奇偶法让取筷方向相反，资源请求无法构成环路。</i>')
      );
    }
    pulse(btn);
  };

  /* ----------------------------------------------------------- 放下筷子 */
  const release = (btn) => {
    let n = 0;
    for (let i = 0; i < N; i++) {
      const st = phil[i];
      if (st.state === 'think') continue;
      st.held.forEach((c) => {
        if (chop[c] === i) chop[c] = null;
      });
      if (st.permit) {
        count++;
        st.permit = false;
      }
      st.held = [];
      st.state = 'think';
      n++;
    }
    dead = false;
    render();
    host.cap(`<b>放下筷子</b>：${n} 位哲学家把筷子放回原处（<i>后取的先放</i>）并回到思考状态，count 信号量也归还。可再次点击第 1 步继续演示。`);
    pulse(btn);
  };

  /* -------------------------------------------------------------- 重置 */
  const reset = (keepStrat) => {
    for (let c = 0; c < N; c++) chop[c] = null;
    for (let i = 0; i < N; i++) phil[i] = { state: 'think', held: [] };
    count = 4;
    dead = false;
    if (!keepStrat) strategy = 'raw';
    stratBtn.textContent = '策略：' + (strategy === 'raw' ? '原始' : strategy === 'limit4' ? '限制4人' : '奇偶有序');
    host.hint(
      strategy === 'ordered'
        ? '当前：<b>资源有序分配（奇偶法）</b> —— 偶数号先左后右、奇数号先右后左，破坏<b>循环等待</b>。'
        : strategy === 'limit4'
          ? '当前：<b>限制至多 4 人取筷</b>（P(count)，count = 4）—— 破坏<b>循环等待</b>。'
          : '当前：<b>原始解法</b> —— 人人「先左后右」，可能因<b>循环等待</b>而死锁。'
    );
    render();
  };

  /* -------------------------------------------------------------- 交互 */
  const btns = host.toolbar([
    { label: '第 1 步：取第一根筷', onClick: (b) => takeFirst(b) },
    { label: '第 2 步：取第二根筷', onClick: (b) => takeSecond(b) },
    { label: '放下筷子（进餐结束）', onClick: (b) => release(b) },
    {
      label: '策略：原始',
      onClick: () => {
        strategy = strategy === 'raw' ? 'limit4' : strategy === 'limit4' ? 'ordered' : 'raw';
        reset(true);
        host.cap(
          strategy === 'raw'
            ? '已切换为<b>原始解法</b>。点击「第 1 步」→「第 2 步」，观察 5 人如何陷入<b>死锁</b>。'
            : strategy === 'limit4'
              ? '已加入 <b>count = 4</b> 信号量限制并发取筷人数。重复两步，观察死锁如何被消除。'
              : '已切换为<b>奇偶法</b>：奇数号先右后左、偶数号先左后右，请求不再成环。'
        );
      },
    },
    { label: '重置', onClick: () => reset(false) },
  ]);
  const stratBtn = btns[3];

  host.hint('当前：<b>原始解法</b> —— 人人「先左后右」，可能因<b>循环等待</b>而死锁。');
  reset(false);
  host.cap('点击 <b>第 1 步</b> 让所有哲学家取第一根筷子，再点 <b>第 2 步</b> 观察是否死锁；用「策略」按钮对比三种解法。');

  /* -------------------------------------------------------------- 每帧 */
  host.onTick((t, dt) => {
    const k = Math.min(1, dt * 6);
    for (let i = 0; i < N; i++) {
      const st = phil[i];
      const col =
        st.state === 'eat' ? p.ok : st.state === 'blocked' ? p.warn : st.state === 'hold1' ? p.accent2 : p.def;
      const orb = phils[i].orb;
      orb.material.color.set(col);
      orb.material.emissive.set(col);
      orb.material.emissiveIntensity = st.state === 'think' ? 0.32 : 0.8 + Math.sin(t * 3 + i) * 0.12;
      const base = philPos(i);
      orb.position.y = base.y + Math.sin(t * 1.8 + i * 0.9) * 0.07 + (st.state === 'eat' ? 0.14 : 0);
      orb.scale.setScalar(1 + (st.state === 'eat' ? Math.sin(t * 5 + i) * 0.04 : 0));
      phils[i].lab.position.set(orb.position.x, orb.position.y + 0.86, orb.position.z);
    }
    for (let c = 0; c < N; c++) {
      const holder = chop[c];
      const m = chopMeshes[c].mesh;
      const col =
        holder == null
          ? p.line2
          : phil[holder].state === 'eat'
            ? p.ok
            : phil[holder].state === 'blocked'
              ? p.warn
              : p.accent2;
      m.material.color.set(col);
      m.material.emissive.set(col);
      m.material.emissiveIntensity = holder == null ? 0.0 : 0.6;
      const ty = holder == null ? 0.95 : 1.16;
      m.position.y += (ty - m.position.y) * k;
    }
    if (dead) {
      const s = 1 + Math.sin(t * 5) * 0.05;
      cycleGrp.children.forEach((g) => g.scale.setScalar(s));
    }
  });
}
