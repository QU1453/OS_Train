/**
 * quiz.js —— 选择题渲染、判分与错题记录。
 *
 * 题目结构（`lessons/<chapter>/<lesson>/quiz.json` → `choice[]`）：
 *   {
 *     "id": "q1",
 *     "stem": "题干，可含 <code> 等行内 HTML",
 *     "options": ["选项A（可含 HTML）", "选项B", "选项C", "选项D"],
 *     "answer": 0,              // 正确选项下标（从 0 开始）
 *     "explain": "解析文本，可含 HTML"
 *   }
 *
 * 判分口径：答对率 = 已答对题数 / 本节总题数，写回 `setChoiceScore`，
 * 答错的题自动进入错题本（`addWrong`）。
 */
import { el, sectionHead } from './util.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** 去除 HTML 标签，用于错题本内的纯文本摘要。 */
function plain(html) {
  const box = document.createElement('div');
  box.innerHTML = html || '';
  return (box.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function renderChoices(page, ctx, ls, items, prog) {
  const list = Array.isArray(items) ? items : [];
  page.append(
    sectionHead({
      kicker: '小题',
      title: '选择题',
      note: list.length ? `${list.length} 题 · 答完自动保存` : '本节暂无小题',
    })
  );

  if (!list.length) {
    page.append(
      el('p', { class: 'hint', text: '（本节小题尚未编写）' })
    );
    return;
  }

  // 已答对情况：{ 题号字符串: true/false }，用于计算答对率
  const correctMap = {};
  Object.entries(prog.choices || {}).forEach(([key, val]) => {
    correctMap[key] = !!(val && val.correct);
  });

  const wrap = el('div', { class: 'choice-list' });
  list.forEach((item, index) => {
    wrap.append(
      choiceCard(ctx, ls, item, index, prog, correctMap, list.length)
    );
  });
  page.append(wrap);
}

function choiceCard(ctx, ls, item, index, prog, correctMap, total) {
  const saved = (prog.choices || {})[String(index)] || null;
  const options = Array.isArray(item.options) ? item.options : [];
  const answer = Number(item.answer);
  let picked = saved && saved.chosen !== null && saved.chosen !== undefined ? saved.chosen : null;
  let locked = !!saved;

  const card = el('div', { class: 'q' });
  card.append(
    el('div', { class: 'q__head' }, [
      el('span', { class: 'q__no', text: `小题 ${index + 1}` }),
      el('div', { class: 'q__stem', html: item.stem || '' }),
    ])
  );

  const list = el('div', { class: 'opts' });
  const explain = el('div', { class: 'explain' });
  explain.append(el('div', { class: 'explain__tag', text: '解析' }));
  explain.append(el('div', { class: 'explain__body', html: item.explain || '（暂无解析）' }));

  // 题解图解宿主：只在 quiz.json 给了 fig 字段时出现，答题揭晓后才懒挂载
  const figHost = item.fig ? el('div', { class: 'qf-host' }) : null;
  if (figHost) explain.append(figHost);
  let figMounted = false;
  function mountFig() {
    if (!figHost || figMounted) return;
    figMounted = true;
    import('./qfig/index.js')
      .then((mod) => mod.mount(figHost, item.fig))
      .catch((err) => {
        console.error('[qfig] 图解加载失败:', item.fig, err);
        figHost.textContent = '';
      });
  }

  const verdict = el('span', { class: 'q__verdict' });
  const foot = el('div', { class: 'q__foot' });
  foot.append(verdict);

  const optNodes = options.map((text, i) => {
    const node = el('div', { class: 'opt' }, [
      el('span', { class: 'opt__key', text: LETTERS[i] || String(i + 1) }),
      el('div', { class: 'opt__text', html: text }),
    ]);
    node.addEventListener('click', () => {
      if (locked) return;
      locked = true;
      picked = i;
      paint();
      const correct = i === answer;
      applyVerdict(verdict, correct);
      settle(correct);
    });
    list.append(node);
    return node;
  });

  function paint() {
    optNodes.forEach((node, i) => {
      node.classList.remove('is-picked', 'is-right', 'is-wrong');
      if (locked) {
        node.classList.add('is-locked');
        if (i === answer) node.classList.add('is-right');
        else if (i === picked) node.classList.add('is-wrong');
      } else if (i === picked) {
        node.classList.add('is-picked');
      }
    });
    explain.classList.toggle('show', locked);
    if (locked) mountFig();
  }

  card.append(list, explain, foot);

  if (locked) applyVerdict(verdict, picked === answer);
  paint();

  async function settle(correct) {
    try {
      await ctx.api.answerChoice(ls.id, index, picked, correct);
    } catch (err) {
      ctx.toast('保存答案失败：' + err.message, 'err');
    }

    if (correct) {
      try {
        await ctx.api.clearWrong(ls.id, index, 'choice');
      } catch { /* 忽略 */ }
    } else {
      try {
        await ctx.api.addWrong(
          ls.id,
          index,
          'choice',
          plain(item.stem),
          '你选了 ' + (LETTERS[picked] || picked) + '，正确答案是 ' + (LETTERS[answer] || answer)
        );
      } catch { /* 忽略 */ }
    }

    correctMap[index] = correct;
    const right = Object.values(correctMap).filter(Boolean).length;
    const fraction = total ? right / total : 0;
    try {
      await ctx.api.setChoiceScore(ls.id, fraction);
    } catch { /* 忽略 */ }
    await ctx.refreshProgress();
    ctx.toast(correct ? `第 ${index + 1} 题：答对` : `第 ${index + 1} 题：答错，已收入错题本`, correct ? 'ok' : 'err');
  }

  return card;
}

function applyVerdict(node, correct) {
  node.classList.remove('ok', 'no');
  node.classList.add(correct ? 'ok' : 'no');
  node.textContent = correct ? '✓ 回答正确' : '✕ 回答错误';
}
