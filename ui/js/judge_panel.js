/**
 * judge_panel.js —— 判题结果面板。
 *
 * Python 侧（app/judge）在子进程里逐行输出 JSON 事件，桥接层把它们经
 * judgeStarted / judgeEvent / judgeFinished / judgeFailed 四个信号转发到前端。
 * 本模块负责：
 *   1. 全局只订阅一次信号（ensureBound）；
 *   2. 每次「运行」由发起它的 view 抢占为 active，事件只投递给该 view；
 *   3. 同时渲染两种判题范式：
 *        deterministic —— case_start / case_result / case_trace / done
 *        concurrency   —— run_start / run_result / done
 *
 * 判题同一时刻只允许一个（Python 侧限制），因此「active」是单值语义。
 */
import { el } from './util.js';
import { on } from './bridge.js';

const views = new Set();
let bound = false;

/** 订阅 Python 侧信号；只订阅一次，投递给 active 的 view。 */
function ensureBound() {
  if (bound) return;
  bound = true;
  const fire = (method, data) => {
    for (const v of [...views]) {
      if (!v.node.isConnected) {
        views.delete(v); // 页面已重渲染，回收失效 view
        continue;
      }
      if (v.isActive()) v[method](data);
    }
  };
  on('judgeStarted', (d) => fire('onStarted', d));
  on('judgeEvent', (d) => fire('onEvent', d));
  on('judgeFinished', (d) => fire('onFinished', d));
  on('judgeFailed', (d) => fire('onFailed', String(d)));
}

/** 把任意值渲染成可读的短文本（用于 期望/实际 对比）。 */
function brief(value) {
  if (value === undefined) return '—';
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    return s === undefined ? '—' : s;
  } catch {
    return String(value);
  }
}

/**
 * 建一个判题面板 view。
 * @param {{onSettled?: Function}} opts 判题结束（成功/失败/取消）后的回调，用于恢复按钮态。
 */
export function createJudgeView(opts = {}) {
  ensureBound();

  const panel = el('div', { class: 'judge-panel' });
  const head = el('div', { class: 'judge-head' });
  const verdict = el('span', { class: 'judge-verdict is-run', text: '判题' });
  const counter = el('span', { class: 'judge-count' });
  head.append(el('span', { text: '判题' }), verdict, counter);

  const summary = el('div', { class: 'judge-summary' });
  const caseList = el('div', { class: 'case-list' });
  const runStrip = el('div', { class: 'run-strip' });
  const evidence = el('div', { class: 'evidence', hidden: true });

  panel.append(head, summary, runStrip, caseList, evidence);

  const st = {
    active: false,
    kind: '',
    caseRows: new Map(),
    runChips: new Map(),
    failRun: null,
    settled: false,
  };

  const view = {
    node: panel,
    isActive: () => st.active,

    /** 开始一次判题：清空上一次结果。 */
    begin() {
      st.active = true;
      st.kind = '';
      st.caseRows.clear();
      st.runChips.clear();
      st.failRun = null;
      st.settled = false;
      caseList.innerHTML = '';
      runStrip.innerHTML = '';
      runStrip.hidden = true;
      evidence.hidden = true;
      evidence.innerHTML = '';
      summary.textContent = '';
      summary.innerHTML = '<span class="spinner"></span>正在编译并运行……';
      counter.textContent = '';
      setVerdict('is-run', '运行中');
      armGuard();
    },

    /** 没有抢占成功 / 启动即失败。 */
    fail(msg) {
      st.active = false;
      setVerdict('is-fail', '未运行');
      summary.textContent = msg || '判题未能启动。';
      settle();
    },

    onStarted(d) {
      st.kind = (d && d.kind) || st.kind;
      if (d && d.title) counter.textContent = d.title;
    },

    onEvent(d) {
      if (!d || typeof d !== 'object') return;
      switch (d.type) {
        case 'start':
          break; // 已由 onStarted 处理
        case 'case_start':
          addCase(d);
          break;
        case 'case_result':
          setCase(d);
          break;
        case 'case_trace':
          attachTrace(d);
          break;
        case 'run_start':
          addRun(d);
          break;
        case 'run_result':
          setRun(d);
          break;
        case 'debug':
          appendTrace(panel, d.trace || '');
          break;
        default:
          break;
      }
    },

    onFinished(d) {
      const kind = d && d.kind ? d.kind : st.kind;
      const verdictName = (d && d.verdict) || 'fail';
      st.active = false;
      summary.textContent = (d && d.summary) || (verdictName === 'pass' ? '全部通过。' : '未通过。');
      if (verdictName === 'cancelled' || (d && d.cancelled)) {
        setVerdict('is-stop', '已停止');
        settle();
        return;
      }

      if (kind === 'concurrency') {
        renderConcurrencySummary(d);
      } else {
        renderDeterministicSummary(d);
      }

      if (verdictName === 'pass') setVerdict('is-pass', `通过 · ${d.score ?? 100}`);
      else setVerdict('is-fail', `未通过 · ${d.score ?? 0}`);
      settle();
    },

    /** 前端兜底：后端信号迟迟未到时，本地把面板切到「已停止」。 */
    stopped(msg) {
      if (st.settled) return;
      st.active = false;
      summary.textContent = msg || '已停止判题。';
      setVerdict('is-stop', '已停止');
      settle();
    },

    onFailed(msg) {
      st.active = false;
      setVerdict('is-fail', '判题失败');
      summary.textContent = msg || '判题进程异常结束。';
      settle();
    },
  };

  function settle() {
    if (st.settled) return;
    st.settled = true;
    clearGuard();
    if (typeof opts.onSettled === 'function') opts.onSettled();
  }

  /* 前端最后一道保险：后端信号万一丢失，也不能让界面永远停在「运行中」。 */
  let guardTimer = 0;
  function clearGuard() {
    if (guardTimer) {
      clearTimeout(guardTimer);
      guardTimer = 0;
    }
  }
  function armGuard() {
    clearGuard();
    guardTimer = setTimeout(() => {
      guardTimer = 0;
      if (!st.active) return;
      st.active = false;
      summary.textContent = '判题长时间没有返回结果，已自动结束等待。可再次点击「运行判题」重试。';
      setVerdict('is-fail', '超时');
      settle();
    }, 150000);
  }

  function setVerdict(cls, text) {
    verdict.className = 'judge-verdict ' + cls;
    verdict.textContent = text;
  }

  /* ------------------------------------------------------ deterministic */

  function addCase(d) {
    const key = d.index;
    if (st.caseRows.has(key)) return;
    const icon = el('span', { class: 'case-row__icon', text: '·' });
    const name = el('span', { class: 'case-row__name', text: d.name || `用例 ${key + 1}` });
    const msg = el('span', { class: 'case-row__msg', text: '运行中…' });
    const row = el('div', { class: 'case-row is-run' }, [icon, name, msg]);
    st.caseRows.set(key, { row, icon, name, msg });
    caseList.append(row);
  }

  function setCase(d) {
    let entry = st.caseRows.get(d.index);
    if (!entry) {
      addCase(d);
      entry = st.caseRows.get(d.index);
    }
    if (!entry) return;
    entry.row.classList.remove('is-run');
    if (d.ok) {
      entry.row.classList.add('is-ok');
      entry.icon.textContent = '✓';
      entry.msg.textContent = '通过';
    } else {
      entry.row.classList.add('is-no');
      entry.icon.textContent = '✕';
      entry.msg.textContent =
        d.msg ||
        `期望 ${brief(d.expected)}，实际 ${brief(d.got)}`;
    }
  }

  function attachTrace(d) {
    const entry = st.caseRows.get(d.index);
    if (!entry) return;
    let box = entry.row.querySelector('.trace-box');
    if (!box) {
      box = el('div', { class: 'trace-box' });
      entry.row.append(box);
    }
    box.textContent += (d.line || '') + '\n';
    entry.row.style.flexWrap = 'wrap';
  }

  function renderDeterministicSummary(d) {
    const cases = Array.isArray(d.cases) ? d.cases : [];
    if (!cases.length && !st.caseRows.size) return;
    const passed = cases.filter((c) => c.ok).length;
    if (cases.length) {
      counter.textContent = `${passed}/${cases.length} 用例通过`;
    } else {
      counter.textContent = `${st.caseRows.size} 个用例`;
    }
  }

  /* ------------------------------------------------------ concurrency */

  function addRun(d) {
    const key = d.run;
    if (st.runChips.has(key)) return;
    runStrip.hidden = false;
    const chip = el('span', { class: 'run-chip is-run', text: `R${key}` });
    st.runChips.set(key, chip);
    runStrip.append(chip);
    counter.textContent = `第 ${d.run}/${d.runs} 轮`;
  }

  function setRun(d) {
    const chip = st.runChips.get(d.run);
    if (chip) {
      chip.classList.remove('is-run');
      chip.classList.add(d.ok ? 'is-ok' : 'is-no');
    }
    if (!d.ok) {
      if (st.failRun === null) st.failRun = d;
      renderRunEvidence(d);
    }
  }

  function renderRunEvidence(d) {
    evidence.hidden = false;
    evidence.innerHTML = '';

    const title = el('div', {
      class: 'evidence__title',
      text: `第 ${d.run} 轮失败${d.reason ? ' · ' + d.reason : ''}`,
    });
    evidence.append(title);

    const list = el('ul');
    const push = (label, text) => {
      if (!text) return;
      list.append(el('li', {}, [el('strong', { text: label + '：' }), document.createTextNode(text)]));
    };

    push('是否跑完', d.finished ? '是' : '否（存在永久等待/死锁）');
    (d.violations || []).forEach((v) => push('不变式', v));
    (d.errors || []).forEach((e) => push('异常', e));
    (d.details || []).forEach((det) => {
      if (det && det.ok === false && det.msg) push(det.name || '校验', det.msg);
    });
    if (typeof d.produced === 'number') {
      push('产出/消费', `${d.produced} / ${d.consumed}（同时在缓冲中最多 ${d.max_in_flight}）`);
    }
    if (list.childNodes.length) evidence.append(list);

    const log = Array.isArray(d.log) ? d.log : [];
    if (log.length) {
      evidence.append(el('div', { class: 'trace-box', text: log.join('\n') }));
    }
  }

  function renderConcurrencySummary(d) {
    const ran = d.ran_runs ?? st.runChips.size;
    const total = d.total_runs ?? ran;
    const passed = d.passed_runs ?? [...st.runChips.values()].length;
    counter.textContent =
      ran < total ? `已跑 ${ran}/${total} 轮 · 通过 ${passed}` : `${passed}/${total} 轮通过`;
  }

  return view;
}

/** 在给定容器追加一个独立的 trace 区块（用于内部错误）。 */
function appendTrace(parent, text) {
  if (!text) return;
  parent.append(el('div', { class: 'trace-box', text }));
}
