/** nav.js —— 侧栏「课程总目录」渲染。 */
import { el, ring, byOrder } from './util.js';

const pad = (n) => String(n ?? 0).padStart(2, '0');

export function lessonFraction(state) {
  if (!state) return 0;
  if (state.status === 'done') return 1;
  return Math.max(0, Math.min(1, Number(state.bestChoice) || 0));
}

export function renderNav(navEl, chapters, summary, current, onSelect) {
  navEl.innerHTML = '';
  if (!chapters || !chapters.length) {
    navEl.append(
      el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state__glyph', text: '[ ]' }),
        el('div', { class: 'empty-state__title', text: '目录为空' }),
        el('div', { class: 'empty-state__text', text: '未找到 lessons/catalog.json。' }),
      ])
    );
    return;
  }

  let delay = 0;
  for (const ch of chapters) {
    const block = el('div', { class: 'nav__chapter' });
    block.append(el('div', { class: 'nav__chapter-title', text: ch.title }));
    for (const ls of byOrder(ch.lessons)) {
      const item = lessonItem(ls, summary, current);
      item.style.animationDelay = `${delay}ms`;
      delay = Math.min(delay + 26, 700);
      item.addEventListener('click', () => onSelect(ls));
      block.append(item);
    }
    navEl.append(block);
  }
}

function lessonItem(ls, summary, current) {
  const state = summary[ls.id];
  const frac = lessonFraction(state);
  const classes = ['nav__item'];
  if (state && state.status === 'done') classes.push('is-done');
  if (!ls.hasContent) classes.push('is-empty');
  if (current && current.id === ls.id) classes.push('is-active');

  const tail = ls.hasContent
    ? ring(frac)
    : el('span', { class: 'badge-empty', text: '待写' });

  return el('div', { class: classes.join(' '), title: `${ls.id} ${ls.title}` }, [
    el('div', { class: 'nav__no', text: pad(ls.order) }),
    el('div', { class: 'nav__title', text: `${ls.id}  ${ls.title}` }),
    tail,
  ]);
}

/** 更新侧栏高亮（不重建 DOM，保留滚动位置）。 */
export function setActive(navEl, lessonId) {
  navEl.querySelectorAll('.nav__item').forEach((node) => {
    const idText = node.querySelector('.nav__no')?.textContent || '';
    node.classList.toggle('is-active', idText && node.getAttribute('title')?.startsWith(lessonId));
  });
}

/** 更新单节完成环（判分 / 标记完成后局部刷新）。 */
export function refreshRing(navEl, lessonId, state) {
  const node = [...navEl.querySelectorAll('.nav__item')].find((n) =>
    (n.getAttribute('title') || '').startsWith(lessonId + ' ')
  );
  if (!node) return;
  const old = node.querySelector('.ring, .badge-empty');
  const frac = lessonFraction(state);
  const fresh = ring(frac);
  if (old) old.replaceWith(fresh);
  node.classList.toggle('is-done', !!state && state.status === 'done');
}
