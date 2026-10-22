/**
 * proc-concept.js —— 进程的概念与特征（2.1.1）
 *
 * 一块「静态程序」如何变成「动态进程」：
 *   可执行文件 → 装入内存 → 进程实体（PCB + 程序段 + 数据段）
 * 同一程序可生成两个进程：代码共享、PCB 与数据段各自独立。
 */
import {
  THREE,
  SceneHost,
  textSprite,
  box,
  cylinder,
  arrow,
  grid,
} from './_runtime.js';

export function mount(node) {
  const host = new SceneHost(node, {
    camPos: [11.2, 7.6, 13.6],
    target: [0, 2.1, 0],
    minDist: 9,
    maxDist: 40,
    maxPolarAngle: Math.PI * 0.49,
    label: '进程实体 = PCB + 程序段 + 数据段',
  });
  const p = host.p;
  host.scene.add(grid(30));

  /* ------------------------------------------------- 静态程序（磁盘上） */
  const disk = box(5.2, 0.32, 2.4, p.surface3, { roughness: 0.85, pos: [0, 0.2, 4.2] });
  host.scene.add(disk);
  const diskLb = textSprite('磁盘：可执行文件 prog.exe（静态）', { color: p.text2, height: 0.4 });
  diskLb.position.set(0, 0.2, 5.7);
  host.scene.add(diskLb);

  /* ------------------------------------------------------------ 进程实体 */
  const makeEntity = (x, tag, tagColor) => {
    const g = new THREE.Group();
    host.scene.add(g);

    const pcb = box(2.7, 0.62, 2.2, tagColor, {
      emissive: tagColor,
      emissiveIntensity: 0.24,
      roughness: 0.42,
      pos: [x, 3.55, 0],
    });
    g.add(pcb);
    const pcbLb = textSprite('PCB 进程控制块', { color: p.text1, height: 0.4 });
    pcbLb.position.set(x, 4.12, 0);
    g.add(pcbLb);

    const code = box(2.7, 0.86, 2.2, p.def, {
      opacity: 0.9,
      emissive: p.def,
      emissiveIntensity: 0.12,
      pos: [x, 2.62, 0],
    });
    g.add(code);
    const codeLb = textSprite('程序段（代码）', { color: p.text2, height: 0.36 });
    codeLb.position.set(x, 2.62, 1.32);
    g.add(codeLb);

    const data = box(2.7, 0.86, 2.2, p.memo, {
      opacity: 0.9,
      emissive: p.memo,
      emissiveIntensity: 0.12,
      pos: [x, 1.62, 0],
    });
    g.add(data);
    const dataLb = textSprite('数据段（变量 / 栈）', { color: p.text2, height: 0.36 });
    dataLb.position.set(x, 1.62, 1.32);
    g.add(dataLb);

    const title = textSprite(tag, { color: tagColor, bg: '#FFFFFF', border: tagColor, height: 0.52 });
    title.position.set(x, 0.86, 0);
    g.add(title);

    const ball = cylinder(0.13, 0.13, 0.08, p.exam, {
      seg: 20,
      emissive: p.exam,
      emissiveIntensity: 1.1,
    });
    ball.rotation.x = Math.PI / 2;
    ball.position.set(x, 2.62, 0);
    g.add(ball);

    return { g, pcb, code, data, title, ball, x };
  };

  const A = makeEntity(-3.5, '进程 P1', p.accent);
  const B = makeEntity(3.5, '进程 P2', p.accent2);

  const a1 = arrow(new THREE.Vector3(-1.4, 1.0, 4.0), new THREE.Vector3(-3.0, 1.15, 0.9), p.line2, { headR: 0.13, opacity: 0.5 });
  const a2 = arrow(new THREE.Vector3(1.4, 1.0, 4.0), new THREE.Vector3(3.0, 1.15, 0.9), p.line2, { headR: 0.13, opacity: 0.5 });
  host.scene.add(a1, a2);
  const forkLb = textSprite('创建进程（复制 PCB、装入代码）', { color: p.text2, height: 0.38 });
  forkLb.position.set(0, 0.75, 3.0);
  host.scene.add(forkLb);

  /* ---------------------------------------------------------- PCB 字段 */
  const FIELDS = [
    ['进程标识符 PID', '唯一身份'],
    ['进程状态', '就绪 / 运行 / 阻塞'],
    ['程序计数器 PC', '下一条指令地址'],
    ['寄存器现场', '通用寄存器、PSW'],
    ['优先级 / 时间片', '调度依据'],
    ['资源清单', '已分配的内存、文件、设备'],
  ];
  const fieldRows = FIELDS.map(([k, v], i) => {
    const y = 0.85 + i * 0.66;
    const bar = box(9.0, 0.46, 0.5, p.surface3, { opacity: 0.96, pos: [0, y, 0] });
    host.scene.add(bar);
    const lb = textSprite(k, { color: p.text1, height: 0.34 });
    lb.position.set(-2.5, y, 0);
    host.scene.add(lb);
    const lb2 = textSprite(v, { color: p.text3, height: 0.3 });
    lb2.position.set(3.05, y, 0);
    host.scene.add(lb2);
    return { bar, lb, lb2 };
  });
  const fieldTitle = textSprite('PCB 里存了什么', { color: p.def, height: 0.5 });
  fieldTitle.position.set(0, 4.9, 0);
  host.scene.add(fieldTitle);

  /* ---------------------------------------------------------------- 状态 */
  const NOTES = {
    prog: {
      cap:
        '<b>程序是静态的</b>：一段存放在磁盘上的可执行文件，没有生命周期，也不占用 CPU。',
      hint: '程序 = <b>静态</b>；进程 = <b>动态</b>。这是最基本的区分。',
    },
    proc: {
      cap:
        '<b>进程实体 = PCB + 程序段 + 数据段</b>。程序被装入内存、分配 PCB 之后，才成为可以被调度执行的「进程」；小球就是那条<b>执行流</b>。',
      hint: '注意：<b>PCB 是进程存在的唯一标志</b>，没有 PCB 就没有进程。',
    },
    two: {
      cap:
        '<b>同一程序可以对应多个进程</b>：两个进程共享只读的<b>程序段</b>，但各有独立的 <b>PCB</b> 与<b>数据段</b>，互不干扰。',
      hint: '考「打开两个记事本」：代码段共享，数据段与 PCB <b>独立</b>。',
    },
    pcb: {
      cap:
        '<b>PCB 是操作系统感知进程的唯一依据</b>：里面有 PID、状态、PC、寄存器现场、优先级与资源清单。进程切换时保存/恢复现场，就是在读写 PCB。',
      hint: '进程与 PCB <b>一一对应</b>；PCB 常组织成链表或索引表。',
    },
  };

  let mode = 'proc';
  const apply = (key) => {
    mode = key;
    const showA = key !== 'prog' && key !== 'pcb';
    const showB = key === 'two';
    A.g.visible = showA;
    B.g.visible = showB;
    disk.visible = key !== 'pcb';
    diskLb.visible = key !== 'pcb';
    a1.visible = showA;
    a2.visible = showB;
    forkLb.visible = key === 'proc' || key === 'two';
    fieldRows.forEach((r) => {
      r.bar.visible = r.lb.visible = r.lb2.visible = key === 'pcb';
    });
    fieldTitle.visible = key === 'pcb';
    host.cap(NOTES[key].cap);
    host.hint(NOTES[key].hint);
  };

  const btns = host.toolbar([
    { label: '静态程序', onClick: (b) => (pick(b), apply('prog')) },
    { label: '一个进程', active: true, onClick: (b) => (pick(b), apply('proc')) },
    { label: '同一程序两个进程', onClick: (b) => (pick(b), apply('two')) },
    { label: 'PCB 里有什么', onClick: (b) => (pick(b), apply('pcb')) },
  ]);
  const pick = (b) => btns.forEach((x) => x.classList.toggle('is-active', x === b));

  apply('proc');

  /* ---------------------------------------------------------------- 每帧 */
  host.onTick((t) => {
    // 执行流小球在程序段里「扫描」指令
    const scan = (ent, o) => {
      if (!ent.g.visible) return;
      const u = (Math.sin(t * 2.2 + o) + 1) / 2;
      ent.ball.position.z = -0.75 + u * 1.5;
      ent.ball.position.y = 2.62 + Math.sin(t * 5 + o) * 0.06;
      ent.ball.scale.setScalar(1 + Math.sin(t * 8 + o) * 0.2);
    };
    scan(A, 0);
    scan(B, 1.6);

    // PCB 呼吸，突出「唯一标志」
    [A, B].forEach((ent, i) => {
      if (!ent.g.visible) return;
      ent.pcb.material.emissiveIntensity = 0.2 + Math.sin(t * 2 + i * 1.3) * 0.1;
    });

    // 创建进程的箭头流动
    [a1, a2].forEach((a, i) => {
      if (!a.visible) return;
      const ln = a.children && a.children[0];
      if (ln && ln.material) ln.material.opacity = 0.3 + Math.abs(Math.sin(t * 2.4 + i)) * 0.5;
    });

    // 磁盘到内存的轻微浮动，暗示「装入」
    diskLb.material.opacity = 0.6 + Math.sin(t * 1.8) * 0.2;
    A.title.material.opacity = 1;
  });
}
