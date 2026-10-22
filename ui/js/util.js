/** util.js —— 无依赖的小工具：DOM 构建、转义、圆环、Toast。 */

/** 创建元素：el('div', {class:'x', onclick:fn}, [child, 'text']) */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (val === null || val === undefined || val === false) continue;
    if (key === 'class') node.className = val;
    else if (key === 'html') node.innerHTML = val;
    else if (key === 'text') node.textContent = val;
    else if (key.startsWith('on') && typeof val === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, val);
    } else {
      node.setAttribute(key, String(val));
    }
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 练习题分区标题：kicker 用于标注「小题 / 大题」，major 为真时用琥珀色（大题）。
 *   sectionHead({ kicker:'小题', title:'选择题', note:'7 题' })
 */
export function sectionHead({ kicker = '', title = '', note = '', major = false } = {}) {
  return el('section', { class: 'section-head' }, [
    kicker
      ? el('span', { class: 'section-head__kicker' + (major ? ' is-major' : ''), text: kicker })
      : null,
    el('h2', { class: 'section-head__title', text: title }),
    el('div', { class: 'section-head__line' }),
    note ? el('span', { class: 'section-head__note', text: note }) : null,
  ]);
}

/** 完成度圆环（SVG），fraction ∈ [0,1]。 */
export function ring(fraction) {
  const r = 7;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, Number(fraction) || 0));
  const off = c * (1 - frac);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'ring' + (frac >= 0.999 ? ' is-full' : ''));
  svg.setAttribute('viewBox', '0 0 18 18');
  const mk = (cls, extra) => {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('class', cls);
    circle.setAttribute('cx', '9');
    circle.setAttribute('cy', '9');
    circle.setAttribute('r', String(r));
    if (extra) {
      circle.setAttribute('stroke-dasharray', String(c));
      circle.setAttribute('stroke-dashoffset', String(off));
      circle.setAttribute('transform', 'rotate(-90 9 9)');
    }
    return circle;
  };
  svg.append(mk('track', false), mk('val', true));
  return svg;
}

let _toastHost = null;
export function toast(message, kind = '') {
  if (!_toastHost) _toastHost = document.getElementById('toast-host');
  if (!_toastHost) return;
  const node = el('div', { class: 'toast ' + kind, text: message });
  _toastHost.append(node);
  setTimeout(() => {
    node.style.transition = 'opacity 200ms, transform 200ms';
    node.style.opacity = '0';
    node.style.transform = 'translateY(6px)';
    setTimeout(() => node.remove(), 220);
  }, 2600);
}

/** 稳定排序：按 order 字段。 */
export function byOrder(list) {
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** 简单的防抖。 */
export function debounce(fn, wait = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
