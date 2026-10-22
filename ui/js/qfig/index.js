/**
 * qfig/index.js —— 题目解析图解注册表
 *
 * 用法：quiz.js 答题后
 *   const host = el('div', { class: 'qf-host' });
 *   explain.append(host);
 *   import('./qfig/index.js').then((m) => m.mount(host, item.fig));
 *
 * 新增课节的图解：在同目录建 `dl-xxx.js` 导出 FIGS 表，再到下面登记一行即可。
 */
import { FIGS as A } from './dl-241.js';
import { FIGS as B } from './dl-242.js';
import { FIGS as C } from './dl-prevent.js'; // 2.4.2 讲义正文逐知识点图解（pv-*）

const REG = { ...A, ...B, ...C };

/**
 * 在 host 内挂载名为 name 的图解。name 不存在时静默返回，不影响答题流程。
 * @param {HTMLElement} host 宿主节点（通常是 .qf-host）
 * @param {string} name 注册名（对应 quiz.json 里的 fig 字段）
 */
export function mount(host, name) {
  if (!host || !name) return;
  const fn = REG[name];
  if (typeof fn !== 'function') {
    console.warn('[qfig] 未注册的图解:', name);
    return;
  }
  host.textContent = '';
  try {
    fn(host);
  } catch (err) {
    console.error('[qfig] 图解渲染失败:', name, err);
    host.textContent = '';
  }
}

/** 已注册的图解名（自检用） */
export const NAMES = Object.keys(REG);
