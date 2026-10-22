/**
 * scenes/index.js —— 3D 演示注册表
 *
 * lesson.js 调用 `mountScene(node, name)` 把讲义里的
 *   <div class="scene" data-scene="name"></div>
 * 挂载为对应的 three.js 演示。每个场景模块导出 `mount(node)`。
 *
 * 若环境不支持 WebGL 或场景加载失败，则回退为文字提示（lesson.js 也会兜底）。
 */
import { webglAvailable } from './_runtime.js';

const LOADERS = {
  'os-concept': () => import('./os-concept.js'),
  'os-evolution': () => import('./os-evolution.js'),
  'os-structure': () => import('./os-structure.js'),
  'os-boot': () => import('./os-boot.js'),
  'os-vm': () => import('./os-vm.js'),
  'os-map': () => import('./os-map.js'),
  'kernel-mode': () => import('./kernel-mode.js'),
  'proc-concept': () => import('./proc-concept.js'),
  'proc-states': () => import('./proc-states.js'),
  'proc-control': () => import('./proc-control.js'),
  'proc-ipc': () => import('./proc-ipc.js'),
  'thread-model': () => import('./thread-model.js'),
  'sched-levels': () => import('./sched-levels.js'),
  'sched-switch': () => import('./sched-switch.js'),
  'sched-metrics': () => import('./sched-metrics.js'),
  'sched-algorithms': () => import('./sched-algorithms.js'),
  'crit-section': () => import('./crit-section.js'),
  'mutex-impl': () => import('./mutex-impl.js'),
  'semaphore-pv': () => import('./semaphore-pv.js'),
  'sem-sync': () => import('./sem-sync.js'),
  'producer-consumer': () => import('./producer-consumer.js'),
  'reader-writer': () => import('./reader-writer.js'),
  'dining-philosophers': () => import('./dining-philosophers.js'),
  monitor: () => import('./monitor.js'),
  banker: () => import('./banker.js'),
  'deadlock-intro': () => import('./deadlock-intro.js'),
  'deadlock-prevent': () => import('./deadlock-prevent.js'),
  'deadlock-detect': () => import('./deadlock-detect.js'),
  'ch2-map': () => import('./ch2-map.js'),
};

const mounted = new WeakSet();

export async function mountScene(node, name) {
  if (!node || mounted.has(node)) return;
  mounted.add(node);

  const loader = LOADERS[name];
  if (!loader) {
    fallback(node, `未注册的 3D 演示：${name}`);
    return;
  }
  if (!webglAvailable()) {
    fallback(node, '当前环境不支持 WebGL，无法显示 3D 演示（不影响阅读讲义与做题）。');
    return;
  }
  try {
    const mod = await loader();
    await mod.mount(node);
  } catch (err) {
    fallback(node, '3D 演示加载失败：' + ((err && err.message) || err));
  }
}

function fallback(node, msg) {
  if (node.querySelector('.scene__fallback')) return;
  const d = document.createElement('div');
  d.className = 'scene__fallback';
  d.textContent = msg;
  node.append(d);
}
