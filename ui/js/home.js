/**
 * home.js —— 首页「课程总目录」。
 *
 * 目标：一次性列出全部课次（29 节），每节显示序号、标题、能力标签与完成度环，
 * 让学习者先看到全貌，再逐节进入。目录数据来自 `bridge.catalog()`。
 */
import { el, ring, byOrder } from './util.js';
import { lessonFraction } from './nav.js';

const pad = (n) => String(n ?? 0).padStart(2, '0');

/** 标签 → 颜色类（按信息功能区分颜色，与 theme.css 语义色对应）。 */
const TAG_CLASS = {
  概念: 'tag--concept',
  计算: 'tag--calc',
  高频: 'tag--hot',
  代码: 'tag--code',
  动画: 'tag--anim',
  真题: 'tag--exam',
};

const LEGEND = [
  ['概念', '概念辨析'],
  ['计算', '需要计算'],
  ['高频', '高频考点'],
  ['代码', '含代码大题'],
  ['动画', '含 3D 演示'],
  ['真题', '真题精讲'],
];

export function renderHome(page, ctx) {
  page.innerHTML = '';
  const chapters = ctx.state.chapters || [];
  const summary = ctx.state.summary || {};
  const lessons = flatten(chapters);

  page.append(hero(lessons, chapters, summary));
  if (chapters.length) page.append(legend());

  let delay = 0;
  chapters.forEach((ch, index) => {
    const block = chapterBlock(ch, index, summary, ctx);
    block.style.animationDelay = `${delay}ms`;
    delay = Math.min(delay + 70, 520);
    page.append(block);
  });

  if (!chapters.length) {
    page.append(
      el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state__glyph', text: '[ ]' }),
        el('div', { class: 'empty-state__title', text: '目录为空' }),
        el('div', {
          class: 'empty-state__text',
          text: '未读取到 lessons/catalog.json 中的章节数据。',
        }),
      ])
    );
  }
}

function flatten(chapters) {
  return chapters.reduce((acc, ch) => acc.concat(ch.lessons || []), []);
}

function hero(lessons, chapters, summary) {
  const done = lessons.filter((ls) => (summary[ls.id] || {}).status === 'done').length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  return el('section', { class: 'hero' }, [
    el('div', { class: 'hero__kicker', text: 'Operating Systems · Review' }),
    el('h1', {
      class: 'hero__title',
      html: '进程与调度：<em>内存管理之前</em>的全部内容',
    }),
    el('p', {
      class: 'hero__lead',
      text:
        '按王道考研《操作系统》的章节顺序整理。先列出全部课次，再逐节完成讲义、' +
        '概念辨析、选择题与代码大题（可运行判题）。所有进度、笔记与草稿都会自动保存。',
    }),
    el('div', { class: 'hero__stats' }, [
      stat(lessons.length, '课次总数'),
      stat(chapters.length, '章节'),
      stat(done, '已完成', done > 0),
      stat(`${pct}%`, '总完成度', pct > 0),
    ]),
  ]);
}

function stat(value, label, accent = false) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat__n' + (accent ? ' is-accent' : ''), text: String(value) }),
    el('div', { class: 'stat__l', text: label }),
  ]);
}

function legend() {
  return el('div', { class: 'legend' }, [
    el('span', { class: 'legend__label', text: 'TAGS' }),
    ...LEGEND.map(([tag, desc]) =>
      el('span', { class: 'legend__item' }, [
        el('span', { class: 'tag ' + (TAG_CLASS[tag] || ''), text: tag }),
        el('span', { class: 'legend__desc', text: desc }),
      ])
    ),
  ]);
}

function chapterBlock(ch, index, summary, ctx) {
  const block = el('section', { class: 'chapter-block' });
  block.append(
    el('div', { class: 'chapter-block__head' }, [
      el('span', { class: 'chapter-block__idx', text: 'CH.' + pad(index + 1) }),
      el('h2', { class: 'chapter-block__title', text: ch.title }),
      el('span', { class: 'chapter-block__count', text: `${ch.lessons.length} 节` }),
    ])
  );
  const grid = el('div', { class: 'card-grid' });
  byOrder(ch.lessons).forEach((ls) => grid.append(lessonCard(ls, summary, ctx)));
  block.append(grid);
  return block;
}

function lessonCard(ls, summary, ctx) {
  const state = summary[ls.id];
  const classes = ['lesson-card'];
  if (state && state.status === 'done') classes.push('is-done');
  if (!ls.hasContent) classes.push('is-empty');

  const tags = el('div', { class: 'lesson-card__tags' });
  (ls.tags || []).forEach((tag) =>
    tags.append(el('span', { class: 'tag ' + (TAG_CLASS[tag] || ''), text: tag }))
  );
  const ringNode = ring(lessonFraction(state));
  ringNode.style.marginLeft = 'auto';
  tags.append(ringNode);

  return el(
    'div',
    {
      class: classes.join(' '),
      title: `${ls.id} ${ls.title}`,
      onclick: () => ctx.openLesson(ls),
    },
    [
      el('div', { class: 'lesson-card__no', text: pad(ls.order) }),
      el('div', { class: 'lesson-card__body' }, [
        el('h3', { class: 'lesson-card__title', text: `${ls.id}  ${ls.title}` }),
        tags,
      ]),
    ]
  );
}
