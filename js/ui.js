// Painel de menu flutuante (o mesmo no PC e no VR): desenhado num canvas e mostrado num
// plano 3D. No VR se aponta com o controle; no PC se clica com o mouse.
import * as THREE from '../vendor/three/three.module.js';

const W = 1024, H = 720;
// Cores do tema (cada jogo tem as suas).
// Pergaminho: papel creme, tinta preta, carimbo carmim.
export const C = {
  bg: '#f2e8cf', edge: '#a8242b', text: '#1f1b17', dim: '#6d6253',
  btn: '#e4d6b4', btnHover: '#d8c493', btnOn: '#a8242b', btnOnText: '#fff6e6', lock: '#d6cdb9',
  rod: '#4a3222', ink: '#1f1b17',
};
export const FONT = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
export { W as PANEL_W, H as PANEL_H };

export class Panel {
  constructor(width = 1.1) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const height = width * H / W;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false }));
    this.mesh.renderOrder = 10;
    this.buttons = [];
    this.hover = -1;
    this.drawFn = null;
  }

  show(drawFn) { this.drawFn = drawFn; this.hover = -1; this.mesh.visible = true; this.redraw(); }
  hide() { this.mesh.visible = false; this.drawFn = null; }
  get visible() { return this.mesh.visible; }

  redraw() {
    const g = this.ctx;
    g.clearRect(0, 0, W, H);
    drawScroll(g, W, H);
    this.buttons = [];
    this.drawFn?.(this);
    this.tex.needsUpdate = true;
  }

  // Ferramentas de desenho para as telas.
  title(text, y = 70) {
    const g = this.ctx;
    g.fillStyle = C.ink; g.font = `bold 54px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, W / 2, y);
    // pincelada carmim embaixo do título
    const tw = Math.min(W - 200, g.measureText(text).width + 60);
    g.fillStyle = 'rgba(168,36,43,0.85)';
    g.beginPath(); g.moveTo(W / 2 - tw / 2, y + 34); g.quadraticCurveTo(W / 2, y + 26, W / 2 + tw / 2, y + 31);
    g.lineTo(W / 2 + tw / 2 - 8, y + 37); g.quadraticCurveTo(W / 2, y + 36, W / 2 - tw / 2 + 4, y + 40); g.closePath(); g.fill();
  }
  text(text, x, y, { size = 32, color = C.text, align = 'center', bold = false } = {}) {
    const g = this.ctx;
    g.fillStyle = color; g.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle';
    g.fillText(text, x, y);
  }
  button(label, action, x, y, w, h, { on = false, locked = false, size = 34, sub = null } = {}) {
    const g = this.ctx;
    const i = this.buttons.length;
    this.buttons.push({ x, y, w, h, action: locked ? null : action });
    g.fillStyle = locked ? C.lock : on ? C.btnOn : (i === this.hover ? C.btnHover : C.btn);
    roundRect(g, x, y, w, h, 16); g.fill();
    if (i === this.hover && !locked) { g.strokeStyle = C.edge; g.lineWidth = 3; g.stroke(); }
    g.fillStyle = on ? C.btnOnText : locked ? C.dim : C.text;
    g.font = `bold ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, x + w / 2, y + h / 2 - (sub ? 14 : 0));
    if (sub) { g.font = `24px ${FONT}`; g.fillStyle = on ? C.btnOnText : C.dim; g.fillText(sub, x + w / 2, y + h / 2 + 20); }
  }
  // uv do raycast → índice do botão
  pick(uv) {
    if (!uv) return -1;
    const x = uv.x * W, y = (1 - uv.y) * H;
    return this.buttons.findIndex(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  }
  setHover(i) { if (i !== this.hover) { this.hover = i; this.redraw(); } }
  actionAt(i) { return i >= 0 ? this.buttons[i]?.action : null; }
}

// Fundo de pergaminho: papel com manchinhas e dois rolos de madeira (em cima e embaixo).
export function drawScroll(g, w, h) {
  g.fillStyle = C.bg; g.fillRect(14, 22, w - 28, h - 44);
  let a = 12345;
  const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let i = 0; i < 40; i++) {
    const x = 14 + r() * (w - 28), y = 22 + r() * (h - 44), rad = 20 + r() * 60;
    const rg = g.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, 'rgba(150,120,70,0.06)'); rg.addColorStop(1, 'rgba(150,120,70,0)');
    g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.strokeStyle = 'rgba(120,90,50,0.35)'; g.lineWidth = 2; g.strokeRect(30, 34, w - 60, h - 68);
  for (const y of [4, h - 26]) {
    const rg = g.createLinearGradient(0, y, 0, y + 22);
    rg.addColorStop(0, '#6b4a30'); rg.addColorStop(0.5, C.rod); rg.addColorStop(1, '#2a1b12');
    g.fillStyle = rg; roundRect(g, 0, y, w, 22, 10); g.fill();
    g.fillStyle = '#a8242b'; roundRect(g, 0, y - 2, 18, 26, 6); g.fill(); roundRect(g, w - 18, y - 2, 18, 26, 6); g.fill();
  }
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// Painel pequeno de texto (FPS, avisos) preso à câmera.
export class Label {
  constructor(width = 0.16, px = 256, py = 64) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = px; this.canvas.height = py;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * py / px),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false }));
    this.mesh.renderOrder = 11;
    this.last = null;
  }
  set(text) {
    if (text === this.last) return;
    this.last = text;
    const g = this.ctx, w = this.canvas.width, h = this.canvas.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(242,232,207,0.85)'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f1b17'; g.font = `bold ${Math.round(h * 0.55)}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2);
    this.tex.needsUpdate = true;
  }
}
