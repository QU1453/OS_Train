/**
 * wrongbook.js —— 错题本：汇总所有答错的选择题与判题失败的代码题。
 *
 * 数据来源：bridge.wrongList() → { items: [{ id, lesson_id, q_index, kind, prompt, detail, created }] }
 */
import { el } from './util.js';

export async function renderWrongBook(page, ctx) {
  page.innerHTML = '';
  ctx.setCrumb('REVIEW', '错题本', false);

  let items = [];
  try {
    const res = await ctx.api.wrongList();
    items = res.items || [];
  } catch (err) {
    page.append(
      el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state__glyph', text: '[ ! ]' }),
        el('div', { class: 'empty-state__title', text: '读取错题本失败' }),
        el('div', { class: 'empty-state__text', text: String((err && err.message) || err) }),
      ])
    );
    return;
  }

  page.append(
    el('header', { class: 'lesson-head' }, [
      el('div', { class: 'lesson-head__no', text: 'WRONG BOOK' }),
      el('h1', { class: 'lesson-head__title', text: '错题本' }),
      el('div', { class: 'lesson-head__meta' }, [
        el('span', { text: `${items.length} 条记录` }),
        el('span', { text: '答对同一题会自动移出' }),
      ]),
    ])
  );

  if (!items.length) {
    page.append(
      el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state__glyph', text: '[ ok ]' }),
        el('div', { class: 'empty-state__title', text: '错题本还是空的' }),
        el('div', {
          class: 'empty-state__text',
          text: '答错的选择题会自动收进这里，判题未通过的代码题也会被记录，方便二刷。',
        }),
      ])
    );
    return;
  }

  const list = el('div', { class: 'wrong-list' });
  items.forEach((item, index) => list.append(wrongRow(ctx, item, index, page)));
  page.append(list);
}

function wrongRow(ctx, item, index, page) {
  const kindLabel = item.kind === 'choice' ? '选择题' : item.kind === 'code' ? '代码题' : (item.kind || '记录');

  const remove = el('button', { class: 'btn btn--sm btn--ghost', text: '移出' });
  remove.addEventListener('click', async () => {
    try {
      await ctx.api.clearWrong(item.lesson_id, item.q_index ?? -1, item.kind || '');
      await renderWrongBook(page, ctx);
      ctx.toast('已移出错题本', 'ok');
    } catch (err) {
      ctx.toast('操作失败：' + err.message, 'err');
    }
  });

  const head = el('div', { class: 'wrong-item__head' }, [
    el('span', { class: 'wrong-item__src', text: item.lesson_id || '—' }),
    el('span', { class: 'wrong-item__kind', text: kindLabel }),
    el('span', { class: 'wrong-item__time', text: item.created || '' }),
    remove,
  ]);

  const goto = el('button', { class: 'btn btn--sm', text: '回到本节' });
  goto.addEventListener('click', () => {
    const ls = findLesson(ctx, item.lesson_id);
    if (!ls) {
      ctx.toast('未找到该课节（可能已从目录移除）', 'err');
      return;
    }
    ctx.navigate(`#/lesson/${ls.chapter}/${ls.id}`);
  });
  head.append(goto);

  const body = [el('div', { class: 'wrong-item__prompt', text: item.prompt || '（无题干摘要）' })];
  if (item.detail) body.push(el('div', { class: 'wrong-item__detail', text: item.detail }));

  return el('div', { class: 'wrong-item' }, [head, ...body]);
}

function findLesson(ctx, lessonId) {
  for (const ch of ctx.state.chapters || []) {
    const hit = (ch.lessons || []).find((ls) => ls.id === lessonId);
    if (hit) return hit;
  }
  return null;
}
