/**
 * editor.js —— 代码大题：CodeMirror 5 编辑器 + 参考答案页签 + 自动保存 + 一键判题。
 *
 * 题目结构（`lessons/<chapter>/<lesson>/quiz.json` → `code[]`）：
 *   {
 *     "id": "c1",
 *     "title": "生产者—消费者问题",
 *     "prompt": "题干（可含 HTML）",
 *     "c_reference": "C 语言参考答案（只读展示）",
 *     "python_reference": "Python 参考答案（可选，只读展示）",
 *     "starter_python": "Python 起始代码（作答起点）",
 *     "judge_problem_id": "pc-bound-buffer",   // 对应 app/judge/problems/<id>/spec.json
 *     "hints": ["提示 1", "提示 2"]
 *   }
 *
 * 作答语言为 Python（判题运行时）；C 仅作参考阅读。草稿按
 * `lessonId / problemId / 'python'` 存进 SQLite，停止输入 700ms 自动保存。
 */
import { el, toast, debounce, sectionHead } from './util.js';
import { createJudgeView } from './judge_panel.js';

const LANG_PY = 'python';
const MODE_PY = 'python';
const MODE_C = 'text/x-csrc';

export async function renderCodeProblems(page, ctx, ls, items, prog) {
  const list = Array.isArray(items) ? items : [];

  if (!list.length) {
    page.append(
      sectionHead({ kicker: '大题', title: '代码大题', note: '本节暂无', major: true })
    );
    page.append(
      el('div', { class: 'qgroup-empty' }, [
        el('span', { class: 'qgroup-empty__mark', text: '[ 大 ]' }),
        el('span', {
          class: 'qgroup-empty__text',
          text: '本节只设小题（选择题），暂未安排大题。',
        }),
      ])
    );
    return;
  }

  page.append(
    sectionHead({
      kicker: '大题',
      title: '代码大题',
      note: `${list.length} 题 · Ctrl+S 保存 · 停止输入自动保存`,
      major: true,
    })
  );

  const drafts = (prog && prog.drafts) || {};
  list.forEach((item, index) => {
    page.append(problemCard(ctx, ls, item, index, drafts));
  });
}

/* --------------------------------------------------------------- 单题卡片 */

function problemCard(ctx, ls, item, index, drafts) {
  const problemId = item.judge_problem_id || item.id || `p${index + 1}`;
  const hasJudge = !!item.judge_problem_id;

  const savedDraft = pickDraft(drafts, problemId, LANG_PY);
  const starter = str(item.starter_python) || 'def solve():\n    # 在这里作答\n    pass\n';
  const initial = savedDraft !== null ? savedDraft : starter;

  const card = el('article', { class: 'codeproblem' });

  /* --- 头部 --- */
  const judgeBadge = el('span', {
    class: 'badge-judge' + (hasJudge ? '' : ' is-nolive'),
    text: hasJudge ? '可运行判题' : '仅参考答案',
  });
  card.append(
    el('div', { class: 'prob-head' }, [
      el('span', { class: 'prob-head__no', text: `大题 ${index + 1}` }),
      el('h3', { class: 'prob-head__title', text: item.title || problemId }),
      judgeBadge,
    ])
  );

  if (item.prompt) {
    card.append(el('div', { class: 'prob-body', html: item.prompt }));
  }

  /* --- 页签 --- */
  const tabs = el('div', { class: 'tabs' });
  const panes = el('div', { class: 'editor-host' });
  const tabDefs = [];

  if (item.c_reference) {
    tabDefs.push({ key: 'c', label: 'C 参考', mode: MODE_C, value: str(item.c_reference), readOnly: true });
  }
  if (item.python_reference) {
    tabDefs.push({
      key: 'pyref',
      label: 'Python 参考',
      mode: MODE_PY,
      value: str(item.python_reference),
      readOnly: true,
    });
  }
  tabDefs.push({ key: 'py', label: 'Python 作答', mode: MODE_PY, value: initial, readOnly: false, primary: true });

  const editors = {};
  const tabNodes = {};
  let activeKey = 'py';

  tabDefs.forEach((def) => {
    const dot = el('span', { class: 'tab__dot' });
    const btn = el('button', { class: 'tab', type: 'button' }, [def.label, dot]);
    btn.addEventListener('click', () => activate(def.key));
    tabNodes[def.key] = { btn, dot };
    tabs.append(btn);

    const pane = el('div', { class: 'pane' });
    pane.dataset.key = def.key;
    editors[def.key] = makeEditor(pane, def);
    panes.append(pane);
  });

  function activate(key) {
    activeKey = editors[key] ? key : activeKey;
    Object.entries(tabNodes).forEach(([k, n]) => {
      n.btn.classList.toggle('is-active', k === activeKey);
    });
    [...panes.children].forEach((p) => {
      p.classList.toggle('is-active', p.dataset.key === activeKey);
    });
    const ed = editors[activeKey];
    if (ed && typeof ed.refresh === 'function') ed.refresh();
  }

  card.append(tabs, panes);

  /* --- 操作条 --- */
  const runBtn = el('button', { class: 'btn btn--run', type: 'button', text: '▶ 运行判题' });
  const stopBtn = el('button', { class: 'btn btn--stop', type: 'button', text: '■ 停止', hidden: true });
  const resetBtn = el('button', { class: 'btn btn--ghost', type: 'button', text: '重置为初始代码' });
  const saveState = el('span', { class: 'save-state', text: savedDraft !== null ? '已恢复草稿' : '尚未修改' });
  const spacer = el('div', { class: 'code-actions__spacer' });

  if (!hasJudge) {
    runBtn.disabled = true;
    runBtn.title = '本题暂无自动判题';
  }

  card.append(
    el('div', { class: 'code-actions' }, [runBtn, stopBtn, resetBtn, spacer, saveState])
  );

  /* --- 提示（可带图解） --- */
  if (Array.isArray(item.hints) && item.hints.length) {
    card.append(hintsBlock(item.hints));
  }

  /* --- 解析（文字 + 解析动画） --- */
  if (item.explain || item.explain_fig) {
    card.append(explainBlock(item));
  }

  /* --- 判题面板 --- */
  /* 停止兜底计时器：后端信号若迟迟不到，本地也要恢复按钮态，绝不让界面卡住。 */
  let stopGuard = 0;
  const clearStopGuard = () => {
    if (stopGuard) {
      clearTimeout(stopGuard);
      stopGuard = 0;
    }
  };

  const judge = createJudgeView({
    onSettled: () => {
      clearStopGuard();
      runBtn.disabled = !hasJudge;
      stopBtn.hidden = true;
      stopBtn.disabled = false;
      stopBtn.textContent = '■ 停止';
      ctx.refreshProgress && ctx.refreshProgress();
    },
  });
  card.append(judge.node);

  const pyEditor = editors.py;

  /* ---------------------------------------------------------- 自动保存 */
  const persist = async (quiet) => {
    try {
      await ctx.api.saveDraft(ls.id, problemId, LANG_PY, pyEditor.getValue());
      saveState.textContent = '已保存 ' + new Date().toLocaleTimeString();
    } catch (err) {
      saveState.textContent = '保存失败';
      if (!quiet) toast('草稿保存失败：' + (err.message || err), 'err');
    }
  };
  const autoSave = debounce(() => persist(true), 700);

  pyEditor.on('change', () => {
    saveState.textContent = '编辑中…';
    tabNodes.py.dot.classList.add('is-on');
    autoSave();
  });
  if (savedDraft !== null) tabNodes.py.dot.classList.add('is-on');

  /* ------------------------------------------------- Ctrl+S 手动保存 */
  /* 自动保存有 700ms 延迟；按下 Ctrl+S 立刻落盘并给出反馈，避免改完就关页面丢代码。 */
  const onHotkey = async (ev) => {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    if (ev.key !== 's' && ev.key !== 'S') return;
    ev.preventDefault();
    ev.stopPropagation();
    await persist(false);
    saveState.textContent = '已保存（Ctrl+S）' + new Date().toLocaleTimeString();
    toast('代码已保存', 'ok');
  };
  panes.addEventListener('keydown', onHotkey, true);
  card.addEventListener('keydown', (ev) => {
    if (ev.defaultPrevented) return;
    onHotkey(ev);
  });

  /* ---------------------------------------------------------- 动作绑定 */
  resetBtn.addEventListener('click', () => {
    pyEditor.setValue(starter);
    persist(true);
    saveState.textContent = '已重置为初始代码';
    toast('已重置为初始代码', 'ok');
  });

  runBtn.addEventListener('click', async () => {
    const code = pyEditor.getValue();
    await persist(true);
    clearStopGuard();
    judge.begin();
    runBtn.disabled = true;
    stopBtn.hidden = false;
    stopBtn.disabled = false;
    stopBtn.textContent = '■ 停止';
    activate('py');
    try {
      const res = await ctx.api.judgeRun(ls.id, problemId, code);
      if (res && res.ok === false) throw new Error(res.error || '判题启动失败');
    } catch (err) {
      judge.fail((err && err.message) || String(err));
      runBtn.disabled = !hasJudge;
      stopBtn.hidden = true;
      toast('判题失败：' + ((err && err.message) || err), 'err');
    }
  });

  stopBtn.addEventListener('click', async () => {
    if (stopBtn.disabled) return;
    stopBtn.disabled = true;
    stopBtn.textContent = '■ 正在停止…';
    // 本地兜底：无论后端信号是否及时送达，0.9s 内必定收尾并恢复按钮。
    clearStopGuard();
    stopGuard = setTimeout(() => {
      stopGuard = 0;
      judge.stopped('已停止判题。');
    }, 900);
    try {
      await ctx.api.judgeCancel();
    } catch { /* 忽略：兜底计时器仍会收尾 */ }
  });

  activate('py');
  return card;
}

/* --------------------------------------------------------------- 组件件 */

/** 统一的编辑器接口（CodeMirror 或降级 textarea）。 */
function makeEditor(host, def) {
  if (typeof window.CodeMirror !== 'function') {
    const ta = el('textarea', { class: 'cm-fallback' });
    ta.value = def.value;
    ta.readOnly = !!def.readOnly;
    host.append(ta);
    return {
      getValue: () => ta.value,
      setValue: (v) => { ta.value = v; },
      refresh: () => {},
      focus: () => ta.focus(),
      on: (ev, fn) => ta.addEventListener(ev, fn),
    };
  }

  const cm = window.CodeMirror(host, {
    value: def.value,
    mode: def.mode,
    theme: 'osdark',
    lineNumbers: true,
    lineWrapping: false,
    readOnly: def.readOnly ? 'nocursor' : false,
    matchBrackets: true,
    autoCloseBrackets: !def.readOnly,
    styleActiveLine: !def.readOnly,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    viewportMargin: Infinity,
  });

  return {
    getValue: () => cm.getValue(),
    setValue: (v) => cm.setValue(v),
    refresh: () => cm.refresh(),
    focus: () => cm.focus(),
    on: (ev, fn) => cm.on(ev, fn),
  };
}

/**
 * 提示区。`hints[]` 支持两种形态：
 *   1. 字符串 —— 纯文字提示；
 *   2. `{ text, fig }` —— 文字 + 一张图解（fig 是 qfig 注册名）。
 * 图解一律懒加载：展开提示时才 import，避免一进页面就挂一堆动画。
 */
function hintsBlock(hints) {
  const list = el('ul', { class: 'hints__list', hidden: true });
  const mounts = [];

  hints.forEach((h) => {
    const isObj = h && typeof h === 'object';
    const text = isObj ? h.text : h;
    const fig = isObj ? h.fig : null;
    const li = el('li', { html: str(text) });
    if (fig) {
      const host = el('div', { class: 'qf-host hints__fig' });
      li.append(host);
      mounts.push(() => mountFig(host, fig));
    }
    list.append(li);
  });

  const toggle = el('button', { class: 'hints__toggle', type: 'button', text: '▸ 查看提示（' + hints.length + '）' });
  let opened = false;
  toggle.addEventListener('click', () => {
    const open = list.hidden;
    list.hidden = !open;
    if (open && !opened) {
      opened = true;
      mounts.forEach((fn) => fn());
    }
    toggle.textContent = (open ? '▾ 收起提示' : '▸ 查看提示') + '（' + hints.length + '）';
  });
  return el('div', { class: 'hints' }, [toggle, list]);
}

/** 解析区：文字解析 + 可选解析图解（同样懒加载）。 */
function explainBlock(item) {
  const box = el('div', { class: 'explain' });
  box.append(el('div', { class: 'explain__label', text: '解析' }));
  if (item.explain) box.append(el('div', { class: 'explain__text', html: str(item.explain) }));
  if (item.explain_fig) {
    const host = el('div', { class: 'qf-host explain__fig' });
    box.append(host);
    mountFig(host, item.explain_fig);
  }
  return box;
}

/** 把 qfig 图解挂到宿主上；模块缺失或渲染失败都静默降级，不影响题卡主体。 */
function mountFig(host, name) {
  import('./qfig/index.js')
    .then((m) => {
      if (m && typeof m.mount === 'function') m.mount(host, name);
    })
    .catch((err) => console.error('[editor] 图解加载失败:', name, err));
}

/* --------------------------------------------------------------- 小工具 */

function str(v) {
  return v === null || v === undefined ? '' : String(v);
}

function pickDraft(drafts, problemId, lang) {
  const entry = drafts && drafts[problemId];
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object' && typeof entry[lang] === 'string') return entry[lang];
  return null;
}
