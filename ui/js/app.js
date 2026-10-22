/**
 * app.js —— 应用入口（ESM）。
 *
 * 职责：
 *   1. 等待 QWebChannel 握手，初始化 `api`/信号订阅；
 *   2. 载入课程目录 + 进度摘要，渲染侧栏目录与首页；
 *   3. 基于 location.hash 的极简路由：#/ 、#/lesson/<chapter>/<id> 、#/wrong ；
 *   4. 顶栏：目录折叠、导出/导入备份、错题本入口。
 *
 * 若在普通浏览器中打开（无桌面外壳），会显示「请通过桌面程序打开」的降级提示。
 */
import { ready, api, on } from './bridge.js';
import { el, toast } from './util.js';
import { renderNav, setActive } from './nav.js';
import { renderHome } from './home.js';
import { renderLesson } from './lesson.js';
import { renderWrongBook } from './wrongbook.js';

const state = { chapters: [], summary: {}, appInfo: {}, current: null };
const dom = {};
let currentLessonId = null;
let navAnimated = false;

/* --------------------------------------------------------------- 启动 */

async function boot() {
  cacheDom();
  wireTopbar();

  try {
    await ready;
  } catch (err) {
    showFatal(err);
    return;
  }

  try {
    state.appInfo = (await api.appInfo()) || {};
    if (state.appInfo.version) {
      document.title = `操作系统复习 · 进程与调度  v${state.appInfo.version}`;
    }
  } catch { /* appInfo 非关键 */ }

  try {
    await on('toast', (payload) => {
      const msg =
        typeof payload === 'string'
          ? payload
          : (payload && (payload.message || payload.text)) || JSON.stringify(payload);
      toast(msg);
    });
  } catch { /* 信号订阅失败不阻塞 */ }

  try {
    await reload();
  } catch (err) {
    showFatal(err);
    return;
  }

  window.addEventListener('hashchange', () => {
    handleRoute().catch((err) => toast('页面渲染失败：' + err.message, 'err'));
  });
}

function cacheDom() {
  dom.app = document.getElementById('app');
  dom.nav = document.getElementById('nav');
  dom.page = document.getElementById('page');
  dom.scroll = document.getElementById('scroll');
  dom.crumb = document.getElementById('crumb');
  dom.overallVal = document.getElementById('overall-val');
  dom.overallBar = document.getElementById('overall-bar');
  dom.meta = document.getElementById('tb-meta');
  dom.btnToggle = document.getElementById('btn-toggle');
  dom.btnReveal = document.getElementById('btn-reveal');
  dom.btnExport = document.getElementById('btn-export');
  dom.btnImport = document.getElementById('btn-import');
  dom.btnWrong = document.getElementById('btn-wrong');
}

/* --------------------------------------------------------- 数据与整体刷新 */

async function reload() {
  const cat = await api.catalog();
  state.chapters = cat.chapters || [];

  const sum = await api.progressSummary();
  state.summary = sum.summary || {};

  renderSidebar();
  updateOverall();
  await handleRoute();
}

function renderSidebar() {
  if (!dom.nav) return;
  renderNav(dom.nav, state.chapters, state.summary, currentLessonId, (ls) => ctx.openLesson(ls));
  if (navAnimated) dom.nav.classList.add('no-anim');
  navAnimated = true;
}

async function refreshProgress() {
  try {
    const sum = await api.progressSummary();
    state.summary = sum.summary || {};
  } catch {
    return;
  }
  updateOverall();
  const keepTop = dom.nav ? dom.nav.scrollTop : 0;
  renderSidebar();
  if (dom.nav) dom.nav.scrollTop = keepTop;
}

function updateOverall() {
  const lessons = allLessons();
  const total = lessons.length;
  const done = lessons.filter((ls) => (state.summary[ls.id] || {}).status === 'done').length;
  if (dom.overallVal) dom.overallVal.textContent = `${done} / ${total}`;
  if (dom.overallBar) dom.overallBar.style.width = total ? `${(done / total) * 100}%` : '0%';
  if (dom.meta) dom.meta.textContent = `${total} 节 · 已完成 ${done}`;
}

function allLessons() {
  return (state.chapters || []).reduce((acc, ch) => acc.concat(ch.lessons || []), []);
}

function findLesson(lessonId) {
  return allLessons().find((ls) => ls.id === lessonId) || null;
}

/* --------------------------------------------------------------- 路由 */

function parseRoute() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (parts[0] === 'lesson' && parts.length >= 3) {
    return { name: 'lesson', chapter: parts[1], id: parts[2] };
  }
  if (parts[0] === 'wrong') return { name: 'wrong' };
  return { name: 'home' };
}

async function handleRoute() {
  const route = parseRoute();

  if (route.name === 'lesson') {
    const ls = findLesson(route.id);
    if (!ls) {
      toast('未找到课节 ' + route.id, 'err');
      ctx.navigate('#/');
      return;
    }
    state.current = ls;
    currentLessonId = ls.id;
    await renderLesson(dom.page, ctx, ls);
    setActive(dom.nav, ls.id);
    if (dom.scroll) dom.scroll.scrollTop = 0;
    return;
  }

  currentLessonId = null;
  setActive(dom.nav, null);
  if (dom.scroll) dom.scroll.scrollTop = 0;

  if (route.name === 'wrong') {
    await renderWrongBook(dom.page, ctx);
  } else {
    setCrumb('HOME', '课程总目录', false);
    renderHome(dom.page, ctx);
  }
}

function setCrumb(ch, title, isEmpty) {
  if (!dom.crumb) return;
  dom.crumb.innerHTML = '';
  dom.crumb.append(
    el('span', { class: 'crumb__ch mono', text: ch }),
    el('span', { class: 'crumb__sep', text: '/' }),
    el('span', { class: 'crumb__title' + (isEmpty ? ' is-empty' : ''), text: title })
  );
}

function navigate(hash) {
  if (location.hash === hash) {
    handleRoute().catch((err) => toast('页面渲染失败：' + err.message, 'err'));
    return;
  }
  location.hash = hash;
}

/* -------------------------------------------------------------- 顶栏 */

function wireTopbar() {
  dom.btnToggle.addEventListener('click', () => setCollapsed(true));
  dom.btnReveal.addEventListener('click', () => setCollapsed(false));
  dom.btnExport.addEventListener('click', onExport);
  dom.btnImport.addEventListener('click', onImport);
  dom.btnWrong.addEventListener('click', () => navigate('#/wrong'));

  let collapsed = false;
  try { collapsed = localStorage.getItem('os.sidebar') === 'collapsed'; } catch { /* 忽略 */ }
  setCollapsed(collapsed);
}

function setCollapsed(collapsed) {
  dom.app.classList.toggle('sidebar-collapsed', collapsed);
  dom.btnToggle.style.display = collapsed ? 'none' : 'grid';
  dom.btnReveal.style.display = collapsed ? 'grid' : 'none';
  try { localStorage.setItem('os.sidebar', collapsed ? 'collapsed' : 'open'); } catch { /* 忽略 */ }
}

/* -------------------------------------------------------- 备份：导出/导入 */

async function onExport() {
  try {
    const res = await api.exportProgress();
    if (res.ok) toast('已导出备份：' + res.path, 'ok');
    else toast('导出失败：' + (res.error || '未知错误'), 'err');
  } catch (err) {
    toast('导出失败：' + err.message, 'err');
  }
}

function onImport() {
  const area = el('textarea', {
    class: 'json-area',
    placeholder: '在此粘贴备份 JSON……',
  });

  const file = el('input', { type: 'file', accept: '.json,application/json' });
  file.addEventListener('change', () => {
    const picked = file.files && file.files[0];
    if (!picked) return;
    const reader = new FileReader();
    reader.onload = () => { area.value = String(reader.result || ''); };
    reader.onerror = () => toast('读取文件失败', 'err');
    reader.readAsText(picked, 'utf-8');
  });

  const doImport = async () => {
    const text = (area.value || '').trim();
    if (!text) {
      toast('请选择备份文件或粘贴 JSON', 'err');
      return;
    }
    try {
      const res = await api.importProgress(text);
      if (!res.ok) throw new Error(res.error || '导入失败');
      dialog.close();
      toast('导入完成，已刷新进度', 'ok');
      await reload();
    } catch (err) {
      toast('导入失败：' + err.message, 'err');
    }
  };

  const dialog = openModal({
    title: '导入进度备份',
    body: [
      el('p', {
        class: 'hint',
        text: '选择此前导出的 progress_*.json，或直接粘贴 JSON 内容；同名字段会被覆盖。',
      }),
      file,
      area,
    ],
    footer: [
      el('button', { class: 'btn btn--ghost', text: '取消', onclick: () => dialog.close() }),
      el('button', { class: 'btn btn--primary', text: '开始导入', onclick: doImport }),
    ],
  });
}

function openModal({ title, body, footer }) {
  const overlay = el('div', { class: 'modal' });
  const panel = el('div', { class: 'modal__panel' });
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (event) => { if (event.key === 'Escape') close(); };

  panel.append(
    el('div', { class: 'modal__head' }, [
      el('h3', { class: 'modal__title', text: title }),
      el('button', { class: 'icon-btn', text: '×', 'aria-label': '关闭', onclick: close }),
    ]),
    el('div', { class: 'modal__body' }, Array.isArray(body) ? body : [body])
  );
  if (footer) panel.append(el('div', { class: 'modal__foot' }, footer));

  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  overlay.append(panel);
  document.body.append(overlay);
  return { close, overlay };
}

/* ------------------------------------------------------------ 致命降级 */

function showFatal(err) {
  const nativeOnly = String((err && err.message) || err) === 'NATIVE_ONLY';
  if (dom.nav) dom.nav.innerHTML = '';
  if (dom.page) {
    dom.page.innerHTML = '';
    dom.page.append(
      el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state__glyph', text: nativeOnly ? '{ }' : '[ ! ]' }),
        el('div', {
          class: 'empty-state__title',
          text: nativeOnly ? '请通过桌面程序打开' : '初始化失败',
        }),
        el('div', {
          class: 'empty-state__text',
          text: nativeOnly
            ? '本页面依赖 PySide6 桌面外壳提供的本地桥接（QWebChannel）。' +
              '请运行 app/main.py，或双击打包后的 OS_Train.exe。'
            : String((err && err.message) || err),
        }),
      ])
    );
  }
  if (dom.meta) dom.meta.textContent = nativeOnly ? 'DESKTOP ONLY' : 'ERROR';
  if (dom.crumb) {
    dom.crumb.innerHTML = '';
    dom.crumb.append(
      el('span', { class: 'crumb__ch mono', text: 'APP' }),
      el('span', { class: 'crumb__sep', text: '/' }),
      el('span', { class: 'crumb__title is-empty', text: nativeOnly ? '需要桌面外壳' : '启动错误' })
    );
  }
}

/* ------------------------------------------------------------ ctx 注入 */

const ctx = {
  state,
  api,
  toast,
  navigate,
  openLesson: (ls) => navigate(`#/lesson/${ls.chapter}/${ls.id}`),
  setCrumb,
  refreshProgress,
  rerender: () => handleRoute(),
};

boot();
