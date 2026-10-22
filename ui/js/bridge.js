/**
 * bridge.js —— 把 QWebChannel 的「回调式」调用封装为 Promise API。
 *
 * Python 侧 `AppBridge` 的所有 @Slot 都返回 JSON 字符串；本模块负责：
 *   1. 等待 QWebChannel 握手完成；
 *   2. 提供 `call(name, ...args)` → Promise<字符串>；
 *   3. 提供 `callJson(name, ...args)` → Promise<解析后的对象>；
 *   4. 提供 `on(signal, handler)` 订阅 Python 侧信号（自动 JSON 解析）。
 *
 * 若在普通浏览器中打开（无 `qt.webChannelTransport`），会优雅降级：
 * `ready` 被 reject，界面显示「请通过桌面程序打开」的提示。
 */

const HANDSHAKE_TIMEOUT = 8000;

let _obj = null;

/** 等待 QWebChannel 连接完成，返回 Python 侧的 bridge 对象。 */
export const ready = new Promise((resolve, reject) => {
  const hasTransport =
    typeof window.qt !== 'undefined' && window.qt && window.qt.webChannelTransport;

  if (typeof window.QWebChannel === 'undefined') {
    reject(new Error('qwebchannel.js 未加载'));
    return;
  }
  if (!hasTransport) {
    reject(new Error('NATIVE_ONLY'));
    return;
  }

  let settled = false;
  const timer = setTimeout(() => {
    if (!settled) reject(new Error('QWebChannel 握手超时'));
  }, HANDSHAKE_TIMEOUT);

  try {
    new window.QWebChannel(window.qt.webChannelTransport, (channel) => {
      settled = true;
      clearTimeout(timer);
      _obj = channel.objects.bridge;
      if (!_obj) reject(new Error('未找到 bridge 对象'));
      else resolve(_obj);
    });
  } catch (err) {
    settled = true;
    clearTimeout(timer);
    reject(err);
  }
});

/** 是否运行在桌面外壳中。 */
export function isNative() {
  return typeof window.qt !== 'undefined' && !!window.qt && !!window.qt.webChannelTransport;
}

/** 原始调用：返回 Python 侧 Slot 的字符串结果。 */
export async function call(name, ...args) {
  const obj = await ready;
  const fn = obj[name];
  if (typeof fn !== 'function') {
    throw new Error(`bridge.${name} 不存在`);
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const guard = setTimeout(() => {
      if (!settled) { settled = true; resolve(undefined); }
    }, 60000);
    try {
      fn(...args, (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        resolve(result);
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      reject(err);
    }
  });
}

/** 调用并解析 JSON；若返回体带 `ok:false` 则抛出，便于 catch。 */
export async function callJson(name, ...args) {
  const raw = await call(name, ...args);
  if (raw === undefined || raw === null || raw === '') return {};
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    throw new Error(`bridge.${name} 返回了非 JSON 内容`);
  }
  if (data && data.ok === false && data.error) {
    const e = new Error(data.error);
    e.payload = data;
    throw e;
  }
  return data;
}

/** 订阅 Python 侧信号；handler 收到解析后的对象。 */
export async function on(signal, handler) {
  const obj = await ready;
  const sig = obj[signal];
  if (!sig || typeof sig.connect !== 'function') return;
  sig.connect((payload) => {
    let data = payload;
    if (typeof payload === 'string') {
      try { data = JSON.parse(payload); } catch { /* 保留原始字符串 */ }
    }
    handler(data);
  });
}

/** 便捷别名（界面层高频使用）。 */
export const api = {
  appInfo: () => callJson('appInfo'),
  catalog: () => callJson('catalog'),
  lesson: (chapter, lessonId) => callJson('lesson', chapter, lessonId),
  progressSummary: () => callJson('progressSummary'),
  lessonState: (lessonId) => callJson('lessonState', lessonId),
  setStatus: (lessonId, status) => callJson('setStatus', lessonId, status),
  markDone: (lessonId) => callJson('markDone', lessonId),
  resetLesson: (lessonId) => callJson('resetLesson', lessonId),
  answerChoice: (lessonId, qIndex, chosen, correct) =>
    callJson('answerChoice', lessonId, qIndex, chosen, correct),
  setChoiceScore: (lessonId, fraction) => callJson('setChoiceScore', lessonId, fraction),
  saveDraft: (lessonId, problemId, language, code) =>
    callJson('saveDraft', lessonId, problemId, language, code),
  saveNote: (lessonId, text) => callJson('saveNote', lessonId, text),
  wrongList: () => callJson('wrongList'),
  addWrong: (lessonId, qIndex, kind, prompt, detail) =>
    callJson('addWrong', lessonId, qIndex, kind, prompt, detail),
  clearWrong: (lessonId, qIndex, kind) => callJson('clearWrong', lessonId, qIndex, kind),
  judgeRun: (lessonId, problemId, code) => callJson('judgeRun', lessonId, problemId, code),
  judgeCancel: () => callJson('judgeCancel'),
  exportProgress: () => callJson('exportProgress'),
  exportProgressJson: () => callJson('exportProgressJson'),
  importProgress: (json) => callJson('importProgress', json),
};
