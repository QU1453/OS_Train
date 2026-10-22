/**
 * _runtime.js —— 3D 场景共享运行时（three.js 封装）
 *
 * 所有课节里的 ` <div class="scene" data-scene="..."> ` 都通过这里统一挂载：
 *   - 统一 WebGLRenderer / 相机 / 灯光 / OrbitControls
 *   - 统一 ResizeObserver 自适应、IntersectionObserver 不可见时暂停渲染
 *   - 离开课节（节点被移除）自动 dispose，避免 rAF 泄漏
 *   - 提供文字精灵（中文标注）、立方体、圆柱、箭头、工具条等绘制助手
 *
 * 配色一律从 theme.css 的 CSS 变量读取，保证 3D 与页面语义配色一致。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export { THREE };

/* ------------------------------------------------------------- 主题取色 */

export function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function palette() {
  return {
    bg0: cssVar('--bg-0', '#F2F4F7'),
    surface: cssVar('--surface', '#FFFFFF'),
    surface3: cssVar('--surface-3', '#E1E7EE'),
    line: cssVar('--line', '#E2E8EF'),
    line2: cssVar('--line-2', '#C9D4E0'),
    text1: cssVar('--text-1', '#16202B'),
    text2: cssVar('--text-2', '#47576A'),
    text3: cssVar('--text-3', '#6B7C8F'),
    accent: cssVar('--accent', '#0B7D6F'),
    accent2: cssVar('--accent-2', '#B26A00'),
    def: cssVar('--sem-def', '#0A66C2'),
    key: cssVar('--sem-key', '#9A5B00'),
    warn: cssVar('--sem-warn', '#C0392B'),
    memo: cssVar('--sem-memo', '#1A7F4B'),
    exam: cssVar('--sem-exam', '#9B1FA8'),
    quote: cssVar('--sem-quote', '#5B6B7C'),
    ok: cssVar('--ok', '#1A7F4B'),
    err: cssVar('--err', '#C0392B'),
  };
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------- 全局驱动 */

const hosts = new Set();
let rafId = 0;

function tickAll(now) {
  rafId = 0;
  for (const h of [...hosts]) {
    if (!h.node.isConnected) {
      h.dispose();
      continue;
    }
    h._frame(now);
  }
  if (hosts.size) rafId = requestAnimationFrame(tickAll);
}

function ensureLoop() {
  if (!rafId) rafId = requestAnimationFrame(tickAll);
}

/* ------------------------------------------------------------- 场景宿主 */

export class SceneHost {
  constructor(node, opts = {}) {
    this.node = node;
    this.opts = opts;
    this.p = palette();
    this.clock = { t: 0, last: 0 };
    this._onTick = null;
    this._onDispose = null;
    this._visible = true;

    const w = Math.max(node.clientWidth, 320);
    const h = Math.max(node.clientHeight, 240);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
    const cp = opts.camPos || [7, 6.2, 10];
    this.camera.position.set(cp[0], cp[1], cp[2]);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.enablePan = false;
    this.controls.minDistance = opts.minDist ?? 4.5;
    this.controls.maxDistance = opts.maxDist ?? 42;
    this.controls.maxPolarAngle = opts.maxPolarAngle ?? Math.PI * 0.5;
    this.controls.target.set(...(opts.target || [0, 0.6, 0]));
    if (opts.autoRotate) {
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = opts.autoRotateSpeed ?? 0.7;
    }

    // 灯光：半球 + 主光 + 强调色轮廓光（浅色场景：天顶取白、地面取浅灰）
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd8e3, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(8, 13, 9);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(this.p.accent), 0.55);
    rim.position.set(-9, 5, -7);
    this.scene.add(rim);

    node.append(renderer.domElement);

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(node);
    this._io = new IntersectionObserver(
      (es) => {
        this._visible = es[0].isIntersecting;
      },
      { threshold: 0.01 }
    );
    this._io.observe(node);

    this.resize();
    if (opts.label) this.label(opts.label);
    hosts.add(this);
    ensureLoop();
  }

  label(text) {
    if (this._labelEl) this._labelEl.remove();
    const d = document.createElement('div');
    d.className = 'scene__label';
    d.textContent = text;
    this.node.append(d);
    this._labelEl = d;
    return d;
  }

  hint(html) {
    if (this._hintEl) this._hintEl.remove();
    const d = document.createElement('div');
    d.className = 'scene__hint';
    d.innerHTML = html;
    this.node.append(d);
    this._hintEl = d;
    return d;
  }

  /** 左下角字幕：随动画步骤实时更新的一行说明 */
  cap(html) {
    if (this._capEl) this._capEl.remove();
    const d = document.createElement('div');
    d.className = 'scene__cap';
    d.innerHTML = html;
    this.node.append(d);
    this._capEl = d;
    return d;
  }

  /** 底部悬浮控制条；items: [{label, onClick(btn), active}] */
  toolbar(items) {
    const old = this.node.querySelector('.scene__bar');
    if (old) old.remove();
    const bar = document.createElement('div');
    bar.className = 'scene__bar';
    const btns = [];
    items.forEach((it) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'scene__btn' + (it.active ? ' is-active' : '');
      b.textContent = it.label;
      b.addEventListener('click', () => it.onClick && it.onClick(b));
      bar.append(b);
      btns.push(b);
    });
    this.node.append(bar);
    return btns;
  }

  onTick(fn) {
    this._onTick = fn;
  }

  onDispose(fn) {
    this._onDispose = fn;
  }

  resize() {
    const w = this.node.clientWidth;
    const h = this.node.clientHeight;
    if (w < 2 || h < 2) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /** 统一入口：把世界坐标点投影到 node 内像素坐标，用于 2D 叠加标注 */
  _frame(now) {
    const dt = this.clock.last ? Math.min((now - this.clock.last) / 1000, 0.05) : 0.016;
    this.clock.last = now;
    if (!this._visible) return;
    this.clock.t += dt;
    if (this._onTick) this._onTick(this.clock.t, dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    hosts.delete(this);
    try {
      this._ro && this._ro.disconnect();
      this._io && this._io.disconnect();
    } catch { /* noop */ }
    try {
      this._onDispose && this._onDispose();
    } catch { /* noop */ }
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => {
        if (m.map && m.map.dispose) m.map.dispose();
        m.dispose && m.dispose();
      });
    });
    this.renderer.dispose();
    const cv = this.renderer.domElement;
    cv && cv.remove();
  }
}

/* ------------------------------------------------------------- 绘制助手 */

export function textSprite(text, opts = {}) {
  const {
    color = '#16202B',
    bg = null,
    border = null,
    fontSize = 40,
    padX = 22,
    padY = 12,
    height = 0.72,
    weight = 600,
    fontFamily = "'Microsoft YaHei UI','PingFang SC','Noto Sans SC',sans-serif",
  } = opts;
  const dpr = 2;
  const cv = document.createElement('canvas');
  let ctx = cv.getContext('2d');
  const fpx = fontSize * dpr;
  ctx.font = `${weight} ${fpx}px ${fontFamily}`;
  const tw = ctx.measureText(String(text)).width;
  cv.width = Math.max(8, Math.ceil(tw + padX * 2 * dpr));
  cv.height = Math.ceil(fpx + padY * 2 * dpr);
  ctx = cv.getContext('2d');
  ctx.font = `${weight} ${fpx}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (bg) {
    ctx.fillStyle = bg;
    _roundRect(ctx, 1, 1, cv.width - 2, cv.height - 2, 12 * dpr);
    ctx.fill();
  }
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 2 * dpr;
    _roundRect(ctx, 1, 1, cv.width - 2, cv.height - 2, 12 * dpr);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.fillText(String(text), cv.width / 2, cv.height / 2 + 1.5 * dpr);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  const aspect = cv.width / cv.height;
  sp.scale.set(height * aspect, height, 1);
  sp.renderOrder = 10;
  return sp;
}

/** 就地替换文字精灵的内容（自动重算宽度），避免每帧新建贴图 */
export function retext(sprite, text, opts = {}) {
  const next = textSprite(text, opts);
  if (sprite.material.map) sprite.material.map.dispose();
  sprite.material.map = next.material.map;
  sprite.material.needsUpdate = true;
  sprite.scale.set(next.scale.x, next.scale.y, 1);
  next.material.dispose();
  return sprite;
}

function _roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) return ctx.roundRect(x, y, w, h, r);
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function box(w, h, d, color, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.roughness ?? 0.5,
    metalness: opts.metalness ?? 0.15,
    emissive: new THREE.Color(opts.emissive ?? 0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.opacity != null,
    opacity: opts.opacity ?? 1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  if (opts.edges !== false) {
    const eg = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: new THREE.Color(opts.edgeColor ?? 0x1F2430), transparent: true, opacity: opts.edgeOpacity ?? 0.14 })
    );
    mesh.add(eg);
  }
  if (opts.pos) mesh.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  return mesh;
}

export function cylinder(rTop, rBottom, height, color, opts = {}) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, opts.seg ?? 32, 1, !!opts.open);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.12,
    emissive: new THREE.Color(opts.emissive ?? 0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.DoubleSide,
    transparent: opts.opacity != null,
    opacity: opts.opacity ?? 1,
  });
  return new THREE.Mesh(geo, mat);
}

export function sphere(r, color, opts = {}) {
  const geo = new THREE.SphereGeometry(r, opts.seg ?? 24, opts.seg ?? 24);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.roughness ?? 0.4,
    metalness: opts.metalness ?? 0.2,
    emissive: new THREE.Color(opts.emissive ?? 0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
  return new THREE.Mesh(geo, mat);
}

export function ring(rInner, rOuter, color, opts = {}) {
  const geo = new THREE.RingGeometry(rInner, rOuter, opts.seg ?? 48);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: opts.opacity ?? 0.5,
  });
  return new THREE.Mesh(geo, mat);
}

/** 箭头（线段 + 锥头），从 a 指向 b（THREE.Vector3） */
export function arrow(a, b, color, opts = {}) {
  const grp = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-4) return grp;
  const headLen = Math.min(opts.headLen ?? 0.34, len * 0.5);

  const lineGeo = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
  const line = new THREE.Line(
    lineGeo,
    new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: opts.opacity ?? 0.85 })
  );
  grp.add(line);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(opts.headR ?? 0.12, headLen, 14),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.35,
      roughness: 0.5,
    })
  );
  const d = dir.clone().normalize();
  cone.position.copy(b).addScaledVector(d, -headLen / 2);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  grp.add(cone);
  return grp;
}

export function tube(points, color, radius = 0.035, opts = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => p.clone()));
  const geo = new THREE.TubeGeometry(curve, Math.max(12, points.length * 12), radius, 8, false);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: opts.emissiveIntensity ?? 0.25,
    roughness: 0.5,
    transparent: opts.opacity != null,
    opacity: opts.opacity ?? 1,
  });
  return new THREE.Mesh(geo, mat);
}

export function line(points, color, opts = {}) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineDashedMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: opts.opacity ?? 0.6,
    dashSize: opts.dash ?? 0.18,
    gapSize: opts.gap ?? 0.12,
  });
  const l = new THREE.Line(geo, mat);
  l.computeLineDistances();
  return l;
}

/** 低透明度地面网格（浅色场景：中心线略深、网格线更浅） */
export function grid(size = 24, color = null) {
  const g = new THREE.GridHelper(size, size, color || 0xb9c4d1, color || 0xdbe2ea);
  g.material.transparent = true;
  g.material.opacity = 0.9;
  return g;
}

export function glow(mesh, color, intensity = 0.9) {
  if (!mesh || !mesh.material || !mesh.material.emissive) return;
  mesh.material.emissive = new THREE.Color(color);
  mesh.material.emissiveIntensity = intensity;
}

export function disposeGroup(group) {
  if (!group) return;
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      if (m.map && m.map.dispose) m.map.dispose();
      m.dispose && m.dispose();
    });
  });
}

/** 缓动 */
export const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const lerp = (a, b, t) => a + (b - a) * t;
