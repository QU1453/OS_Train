/**
 * qfig/_runtime.js —— 题目解析图解运行时（纯 HTML/CSS，不走 WebGL）
 *
 * 两类产物：
 *   - 静态图表：一次性把结构铺出来，读图即懂（用于定义辨析、对照表、集合关系）
 *   - 分步动画：多步累积揭示 + 底部字幕 + 上下步 / 自动 / 重播（用于多跳推理）
 *
 * 分步揭示靠三个 data 属性，全部由 CSS 过渡驱动，无 JS 逐帧：
 *   data-step="n"  第 n 步起出现并常驻（累积）
 *   data-off="n"   第 n 步起消失（用于「先立后倒」）
 *   data-hl="n"    仅第 n 步高亮（用于逐步聚焦）
 */
import { el } from '../util.js';

/** HTML 字符串 → 可查询的文档片段（便于写带 data-step 的复杂结构） */
export function frag(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html).trim();
  return t.content;
}

/**
 * 建图解外壳。
 * @returns {{box:HTMLElement, stage:HTMLElement, steps:(list:string[],opts?:object)=>void}}
 */
export function figure(host, opts = {}) {
  const { kicker = '', title = '', badge = '' } = opts;

  const stage = el('div', { class: 'qf__stage' });
  const box = el('div', { class: 'qf' }, [
    el('div', { class: 'qf__head' }, [
      kicker ? el('span', { class: 'qf__kicker', text: kicker }) : null,
      el('span', { class: 'qf__title', text: title }),
      badge ? el('span', { class: 'qf__badge', text: badge }) : null,
    ]),
    stage,
  ]);
  host.append(box);

  /** 静态图表：调用即结束（steps 不调用） */
  function steps(list, o = {}) {
    const items = (list || []).filter((s) => typeof s === 'string' && s.length);
    const total = items.length;
    if (!total) return;

    const capEl = el('div', { class: 'qf__cap' });
    const counter = el('span', { class: 'qf__count' });
    const prevB = el('button', { class: 'qf__btn', type: 'button', text: '上一步' });
    const nextB = el('button', { class: 'qf__btn', type: 'button', text: '下一步' });
    const playB = el('button', { class: 'qf__btn', type: 'button', text: '自动' });
    const againB = el('button', { class: 'qf__btn', type: 'button', text: '重播' });
    const bar = el('div', { class: 'qf__bar' }, [prevB, nextB, playB, againB]);

    box.append(
      el('div', { class: 'qf__foot' }, [
        capEl,
        el('div', { class: 'qf__nav' }, [counter, bar]),
      ])
    );

    let k = 1;
    let timer = 0;
    let auto = false;
    let played = false; // 视口自动播只播一次（用户回头再看时不再重播）
    let touched = false; // 用户点过按钮后，视口不再接管播放状态
    let io = null;

    function paint() {
      k = Math.max(1, Math.min(total, k));
      stage.querySelectorAll('[data-step]').forEach((n) => {
        n.classList.toggle('is-on', k >= Number(n.dataset.step) || 0);
      });
      stage.querySelectorAll('[data-off]').forEach((n) => {
        n.classList.toggle('is-on', k < Number(n.dataset.off));
      });
      stage.querySelectorAll('[data-hl]').forEach((n) => {
        n.classList.toggle('is-hl', k === Number(n.dataset.hl));
      });
      capEl.innerHTML = items[k - 1];
      counter.textContent = `STEP ${k} / ${total}`;
      prevB.disabled = k <= 1;
      nextB.disabled = k >= total;
      if (k >= total) setAuto(false);
    }

    function loop() {
      if (!auto) return;
      if (k >= total) {
        setAuto(false);
        return;
      }
      timer = setTimeout(() => {
        k += 1;
        paint();
        loop();
      }, o.hold ?? 1700);
    }

    function setAuto(on) {
      auto = !!on;
      clearTimeout(timer);
      playB.classList.toggle('is-on', auto);
      playB.textContent = auto ? '暂停' : '自动';
      if (auto) loop();
    }

    /**
     * 讲义内嵌图解：一页里会有十几个，若载入即自动播，等用户滚到那里早就播完了。
     * 所以 auto:'view' 改为滚入视口才启动，滚出视口立即暂停定时器。
     */
    function watchView() {
      if (typeof IntersectionObserver !== 'function') {
        setAuto(true);
        return;
      }
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              if (!played && !touched) {
                played = true;
                k = 1;
                paint();
                setAuto(true);
              }
            } else if (auto && !touched) {
              setAuto(false);
            }
          });
        },
        { threshold: 0.3 }
      );
      io.observe(box);
    }

    prevB.addEventListener('click', () => {
      touched = true;
      setAuto(false);
      k -= 1;
      paint();
    });
    nextB.addEventListener('click', () => {
      touched = true;
      setAuto(false);
      k += 1;
      paint();
    });
    playB.addEventListener('click', () => {
      touched = true;
      setAuto(!auto);
    });
    againB.addEventListener('click', () => {
      touched = true;
      k = 1;
      paint();
      setAuto(true);
    });

    paint();
    if (reduceMotion()) {
      k = total;
      paint();
    } else if (o.auto === 'view') {
      watchView();
    } else if (o.auto !== false) {
      setAuto(true);
    }

    // 图解被移除（切课节）时停掉定时器与视口观察
    if (typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(() => {
        if (!box.isConnected) {
          setAuto(false);
          if (io) io.disconnect();
          mo.disconnect();
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    return {
      total,
      /** 从头重播（外部主动控制时用） */
      play() {
        touched = false;
        played = true;
        k = 1;
        paint();
        setAuto(true);
      },
      stop() {
        setAuto(false);
      },
    };
  }

  return { box, stage, steps };
}

/** 系统开了「减少动态效果」时，直接把分步结果全铺开，不做逐帧播放 */
function reduceMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ------------------------------------------------------------ 小构件 */

export function chip(text, kind = '') {
  return el('span', { class: 'qf-chip' + (kind ? ' ' + kind : ''), html: text });
}

export function banner(html, kind = '') {
  return el('div', { class: 'qf-banner' + (kind ? ' ' + kind : ''), html });
}

/** 进程 / 资源方块 */
export function nodeBox(text, opts = {}) {
  return el(
    'div',
    {
      class: 'qf-node' + (opts.kind ? ' qf-node--' + opts.kind : ''),
      style: opts.color ? `--c:${opts.color}` : null,
      html: text,
    },
    opts.sub ? [el('span', { class: 'qf-node__sub', text: opts.sub })] : []
  );
}

/** 直箭头：dir = 'h' | 'v' */
export function arrow(dir = 'h', color = '') {
  return el('span', {
    class: `qf-arw qf-arw--${dir}`,
    style: color ? `--c:${color}` : null,
  });
}
