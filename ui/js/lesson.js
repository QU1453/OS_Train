/**
 * lesson.js —— 单节课页面：讲义正文 + 3D 演示 + 选择题 + 代码大题 + 笔记。
 *
 * 数据来源：
 *   bridge.lesson(chapter, lessonId) → { meta, content(HTML 字符串), quiz:{choice,code} }
 *   bridge.lessonState(lessonId)     → { choices, drafts, note }
 *
 * 讲义 content.html 支持以下语义块（配合 theme.css）：
 *   <div class="blk def|key|warn|memo|exam|quote"><div class="blk__label">…</div>…</div>
 *   <table class="tbl">…</table>  <pre class="formula">…</pre>
 *   <div class="scene" data-scene="scene-name"></div>
 */
import { el, toast, debounce, sectionHead } from './util.js';
import { renderChoices } from './quiz.js';

export async function renderLesson(page, ctx, ls) {
  page.innerHTML = '';
  ctx.setCrumb(ls.chapter.toUpperCase(), `${ls.id}  ${ls.title}`, false);

  if (!ls.hasContent) {
    page.append(pendingLesson(ls, ctx));
    return;
  }

  let data;
  try {
    data = await ctx.api.lesson(ls.chapter, ls.id);
  } catch (err) {
    page.append(errorLesson(ls, err));
    return;
  }

  let prog = { choices: {}, drafts: {}, note: '' };
  try {
    const res = await ctx.api.lessonState(ls.id);
    prog = res.state || prog;
  } catch { /* 首次进入无记录，属正常 */ }

  const meta = data.meta || {};
  const quiz = data.quiz || { choice: [], code: [] };

  page.append(lessonHead(ls, meta));

  const contentWrap = el('div', { class: 'content', html: data.content || '' });
  const toc = buildToc(contentWrap, ls);
  if (toc) page.append(toc.node);
  page.append(contentWrap);
  if (toc) toc.spy();
  mountScenes(contentWrap);
  mountQfigs(contentWrap);

  renderChoices(page, ctx, ls, quiz.choice, prog);
  await renderCode(page, ctx, ls, quiz.code, prog);

  page.append(noteBlock(ctx, ls, prog.note));
  page.append(lessonActions(ctx, ls));
}

/* ---------------------------------------------------------- 本节目录（TOC） */

/**
 * 讲义正文是运行时注入的 HTML 字符串，所以小目录只能在 DOM 就绪后扫描标题生成。
 * 29 节的标题层级并不统一（有的是 h2 小节 + h3 子小节，有的首 h2 就是本节名），
 * 因此按 DOM 顺序平铺成单层目录，只用字号/缩进区分 h2 与 h3，不做折叠。
 */
function buildToc(root, ls) {
  const heads = [...root.querySelectorAll('h2, h3')];
  if (heads.length < 2) return null;

  const rows = [];
  heads.forEach((node, i) => {
    const text = squeeze(node.textContent);
    if (!text) return;
    node.id = `sec-${i + 1}`;
    node.classList.add('h-anchor');
    rows.push({ node, text, lv: node.tagName === 'H2' ? 2 : 3 });
  });
  if (rows.length < 2) return null;

  // 首个 h2 若就是本节名（如「2.4.2 死锁预防」），页面顶部已展示，目录里不再重复
  const key = String(ls.id || '').replace(/\s+/g, '');
  if (rows[0].lv === 2 && key && squeeze(rows[0].text).replace(/\s+/g, '').startsWith(key)) {
    rows.shift();
  }

  const list = el('ol', { class: 'toc__list' });
  const links = rows.map((row, i) => {
    const link = el(
      'button',
      {
        class: 'toc__link' + (row.lv === 3 ? ' is-lv3' : ''),
        type: 'button',
        title: row.text,
      },
      [
        el('span', { class: 'toc__idx', text: String(i + 1).padStart(2, '0') }),
        el('span', { class: 'toc__text', text: row.text }),
      ]
    );
    link.addEventListener('click', () => {
      row.node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      links.forEach((n) => n.classList.remove('is-active'));
      link.classList.add('is-active');
    });
    list.append(el('li', { class: 'toc__item' }, [link]));
    return link;
  });

  const node = el('nav', { class: 'toc', 'aria-label': '本节目录' }, [
    el('div', { class: 'toc__head' }, [
      el('span', { class: 'toc__label', text: 'Contents' }),
      el('span', { class: 'toc__title', text: '本节目录' }),
      el('span', { class: 'toc__line' }),
      el('span', { class: 'toc__count', text: `${rows.length} 小节` }),
    ]),
    list,
  ]);

  /** 滚动时高亮当前小节；离开本页后自动摘掉监听，避免监听器泄漏。 */
  function spy() {
    const scroller = node.closest('.scroll') || document.querySelector('.scroll');
    if (!scroller) return;
    let raf = 0;
    function sync() {
      raf = 0;
      if (!node.isConnected) {
        scroller.removeEventListener('scroll', onScroll);
        return;
      }
      const base = scroller.getBoundingClientRect().top + 108;
      let hit = 0;
      rows.forEach((row, i) => {
        if (row.node.getBoundingClientRect().top <= base) hit = i;
      });
      links.forEach((n, i) => n.classList.toggle('is-active', i === hit));
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(sync);
    }
    scroller.addEventListener('scroll', onScroll, { passive: true });
    sync();
  }

  return { node, spy };
}

function squeeze(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ 头部 */

function lessonHead(ls, meta) {
  const bits = [];
  if (meta.difficulty) bits.push(['难度', meta.difficulty]);
  if (meta.minutes) bits.push(['建议时长', `${meta.minutes} 分钟`]);
  if (meta.exam) bits.push(['考点', meta.exam]);
  return el('header', { class: 'lesson-head' }, [
    el('div', { class: 'lesson-head__no', text: `第 ${ls.order} 节 · ${ls.id}` }),
    el('h1', { class: 'lesson-head__title', text: ls.title }),
    el(
      'div',
      { class: 'lesson-head__meta' },
      [
        el('span', { text: ls.chapterTitle || ls.chapter }),
        ...(ls.tags || []).map((t) => el('span', { class: 'tag', text: t })),
        ...bits.map(([k, v]) => el('span', { text: `${k}：${v}` })),
      ]
    ),
  ]);
}

/* ------------------------------------------------------------ 3D 场景挂载 */

async function mountScenes(root) {
  const nodes = [...root.querySelectorAll('.scene[data-scene]')];
  if (!nodes.length) return;

  let mod = null;
  try {
    mod = await import('./scenes/index.js');
  } catch { /* 场景模块尚未接入 */ }

  nodes.forEach((node) => {
    if (mod && typeof mod.mountScene === 'function') {
      Promise.resolve(mod.mountScene(node, node.dataset.scene)).catch(() => sceneFallback(node));
    } else {
      sceneFallback(node);
    }
  });
}

function sceneFallback(node) {
  if (node.querySelector('.scene__fallback')) return;
  node.append(
    el('div', {
      class: 'scene__fallback',
      text: '3D 演示尚未接入（或当前环境不支持 WebGL）。',
    })
  );
}

/* ------------------------------------------------------ 讲义内嵌图解挂载 */

/**
 * 讲义正文里一个知识小点配一张 `[data-qfig]` 图解（纯 DOM，不走 WebGL）。
 * 一页会嵌十几张，所以不在载入时统一播放：各图自己带 IntersectionObserver，
 * 滚进视口才开始播、滚出去就暂停。这里只负责把图形铺出来。
 */
async function mountQfigs(root) {
  const nodes = [...root.querySelectorAll('[data-qfig]')];
  if (!nodes.length) return;

  let mod = null;
  try {
    mod = await import('./qfig/index.js');
  } catch { /* 图解模块尚未接入 */ }

  nodes.forEach((node) => {
    if (!mod || typeof mod.mount !== 'function') return;
    try {
      mod.mount(node, node.dataset.qfig);
    } catch (err) {
      console.error('[qfig] 讲义图解渲染失败:', node.dataset.qfig, err);
    }
  });
}

/* ------------------------------------------------------------ 代码大题区 */

async function renderCode(page, ctx, ls, codeItems, prog) {
  const items = Array.isArray(codeItems) ? codeItems : [];

  let mod = null;
  try {
    mod = await import('./editor.js');
  } catch { /* 编辑器模块尚未接入 */ }

  // 无大题也交给 editor.js 渲染分区与空态，保证「大题 / 小题」始终成对出现
  if (mod && typeof mod.renderCodeProblems === 'function') {
    await mod.renderCodeProblems(page, ctx, ls, items, prog);
    return;
  }
  if (!items.length) return;

  page.append(
    sectionHead({
      kicker: '大题',
      title: '代码大题',
      note: `${items.length} 题`,
      major: true,
    })
  );
  page.append(
    el('div', { class: 'q' }, [
      el('div', { class: 'hint', text: '代码编辑器与沙箱判题模块尚未接入，下一阶段完成。' }),
    ])
  );
}

/* ------------------------------------------------------------------ 笔记 */

function noteBlock(ctx, ls, initial) {
  const area = el('textarea', {
    class: 'note-area',
    placeholder: '写点笔记：易错点、自己的总结、口诀……（停止输入后自动保存）',
  });
  area.value = initial || '';

  const status = el('span', { class: 'hint', text: '未修改' });
  const save = debounce(async () => {
    try {
      await ctx.api.saveNote(ls.id, area.value);
      status.textContent = '已保存 ' + new Date().toLocaleTimeString();
    } catch (err) {
      status.textContent = '保存失败';
      toast('笔记保存失败：' + err.message, 'err');
    }
  }, 700);

  area.addEventListener('input', () => {
    status.textContent = '编辑中…';
    save();
  });

  return el('section', {}, [
    el('div', { class: 'section-head' }, [
      el('h2', { class: 'section-head__title', text: '我的笔记' }),
      el('div', { class: 'section-head__line' }),
      status,
    ]),
    area,
  ]);
}

/* ------------------------------------------------------------ 课节操作行 */

function lessonActions(ctx, ls) {
  const doneBtn = el('button', { class: 'btn btn--primary', text: '标记本节完成' });
  doneBtn.addEventListener('click', async () => {
    try {
      await ctx.api.markDone(ls.id);
      await ctx.refreshProgress();
      toast('已标记完成：' + ls.id, 'ok');
    } catch (err) {
      toast('操作失败：' + err.message, 'err');
    }
  });

  const resetBtn = el('button', { class: 'btn btn--ghost', text: '重置本节记录' });
  resetBtn.addEventListener('click', async () => {
    try {
      await ctx.api.resetLesson(ls.id);
      await ctx.refreshProgress();
      toast('已重置：' + ls.id, 'ok');
      await ctx.rerender();
    } catch (err) {
      toast('重置失败：' + err.message, 'err');
    }
  });

  return el('section', { style: 'margin-top:40px' }, [
    el('div', { class: 'section-head' }, [
      el('h2', { class: 'section-head__title', text: '收尾' }),
      el('div', { class: 'section-head__line' }),
    ]),
    el('div', { class: 'row' }, [doneBtn, resetBtn]),
  ]);
}

/* ------------------------------------------------------------ 占位 / 错误 */

function pendingLesson(ls, ctx) {
  return el('div', {}, [
    lessonHead(ls, {}),
    el('div', { class: 'empty-state' }, [
      el('div', { class: 'empty-state__glyph', text: '[ // ]' }),
      el('div', { class: 'empty-state__title', text: '本节讲义与练习尚未编写' }),
      el('div', {
        class: 'empty-state__text',
        text:
          '目录中已列出该课次，内容将按章节顺序逐节补齐。' +
          '补齐后本节会自动出现讲义、选择题与代码大题。',
      }),
      el('div', { class: 'row', style: 'justify-content:center;margin-top:20px' }, [
        el('button', {
          class: 'btn',
          text: '← 返回课程总目录',
          onclick: () => ctx.navigate('#/'),
        }),
      ]),
    ]),
  ]);
}

function errorLesson(ls, err) {
  return el('div', {}, [
    lessonHead(ls, {}),
    el('div', { class: 'empty-state' }, [
      el('div', { class: 'empty-state__glyph', text: '[ ! ]' }),
      el('div', { class: 'empty-state__title', text: '读取课节失败' }),
      el('div', { class: 'empty-state__text', text: String((err && err.message) || err) }),
    ]),
  ]);
}
