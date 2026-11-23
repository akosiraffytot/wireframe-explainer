// Scene primitives for `tpl: "compose"`.
// A compose scene is an ordered list of elements; array order is draw order.
// Every primitive takes (ctx, el, t, p) where p is its 0..1 reveal progress.
import { PAL, chipObj, stackObj, cubeObj, rings, figure, meter, panel, xMark, tick, line, label, labelWidth } from "./draw.mjs";
import { dotText } from "./dotfont.mjs";
import { seg, clamp01, easeOut } from "./draw.mjs";

const FONT = '"Arial","Helvetica Neue",Helvetica,"Liberation Sans",sans-serif';

export function reveal(t, el, dflt = 0.45) {
  const t0 = el.t0 ?? 0;
  return seg(t, t0, t0 + (el.reveal ?? dflt));
}
const A = (el) => el.at ?? [360, 640];

function caption(ctx, txt, x, y, size, color, alpha, align = "center") {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.fillStyle = color ?? PAL.white;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 14;
  ctx.fillText(txt, x, y);
  ctx.restore();
}

// ---------------------------------------------------------------- primitives
export const PRIMS = {
  // a chip die. {at, size, thick, color, inner, pins}
  chip(ctx, el, t, p) {
    const [x, y] = A(el);
    chipObj(ctx, { cx: x, cy: y, size: el.size ?? 220, thick: el.thick ?? 16, fill: el.fill ?? PAL.ink, stroke: el.color ?? PAL.lime, glow: el.glow ?? 14, inner: el.inner ?? true, pinCount: el.pins ?? 7, alpha: p });
  },
  // a tower of layers. {at, size, layers, gap, thick}
  stack(ctx, el, t, p) {
    const [x, y] = A(el);
    stackObj(ctx, { cx: x, cy: y, size: el.size ?? 210, layers: el.layers ?? 6, gap: el.gap ?? 28, thick: el.thick ?? 12, alpha: p, progress: el.build ?? easeOut(clamp01(p * 1.2)) });
  },
  // an upright box / cabinet. {at, size, height}
  box(ctx, el, t, p) {
    const [x, y] = A(el);
    cubeObj(ctx, { cx: x, cy: y, size: el.size ?? 140, height: el.height ?? 200, stroke: el.color ?? PAL.lime, alpha: p });
  },
  // concentric iso rings. {at, n, r0, gap}
  rings(ctx, el, t, p) {
    const [x, y] = A(el);
    rings(ctx, x, y, { n: el.n ?? 3, r0: el.r0 ?? 60, gap: el.gap ?? 34, progress: p, color: el.color ?? PAL.lime, alpha: (el.alpha ?? 0.9) * p });
  },
  // stick figure, feet at `at`. {at, h, walk, arms, color}
  figure(ctx, el, t, p) {
    const [x, y] = A(el);
    const h = el.h ?? 120;
    figure(ctx, x, y - h, h, { stride: el.walk ? t * 7 : 0, arms: el.arms ?? "down", color: el.color ?? PAL.white, alpha: p });
  },
  // dot-matrix label, top-left at `at`. {at, text, size, color}
  label(ctx, el, t, p) {
    const [x, y] = A(el);
    label(ctx, el.text ?? "", x, y, { size: el.size ?? 24, color: el.color ?? PAL.offWhite, alpha: p });
  },
  // big dot-matrix word, centred on `at`. {at, text, size, color}
  word(ctx, el, t, p) {
    const [x, y] = A(el);
    const size = el.size ?? 64;
    const w = labelWidth(el.text ?? "", size);
    dotText(ctx, el.text ?? "", x - w / 2, y - size / 2, { size, color: el.color ?? PAL.lime, alpha: p, glow: el.glow ?? 16 });
  },
  // bold caption-font text inside the scene. {at, text, size, color}
  text(ctx, el, t, p) {
    const [x, y] = A(el);
    if (el.bg) {
      ctx.save();
      ctx.globalAlpha = p;
      ctx.fillStyle = el.bg;
      ctx.fillRect(x - el.w / 2, y - (el.size ?? 34) * 0.7, el.w ?? 200, (el.size ?? 34) * 1.4);
      ctx.restore();
    }
    caption(ctx, el.text ?? "", x, y, el.size ?? 34, el.color ?? PAL.white, p);
  },
  // a boxed label. {at, text, size, w, h, color}
  badge(ctx, el, t, p) {
    const [x, y] = A(el);
    const w = el.w ?? labelWidth(el.text ?? "", el.size ?? 28) + 36;
    const h = el.h ?? 54;
    panel(ctx, x - w / 2, y - h / 2, w, h, { stroke: el.color ?? PAL.lime, fill: "rgba(8,14,6,0.92)", alpha: p });
    const size = el.size ?? 28;
    label(ctx, el.text ?? "", x - labelWidth(el.text ?? "", size) / 2, y - size / 2, { size, color: el.color ?? PAL.lime, alpha: p });
  },
  // horizontal meter. {at, w, h, value, color, caption}
  meter(ctx, el, t, p) {
    const [x, y] = A(el);
    const w = el.w ?? 150, h = el.h ?? 18;
    meter(ctx, x, y, w, h, easeOut(clamp01(p)) * (el.value ?? 0.7), { color: el.color ?? PAL.lime, alpha: p });
    if (el.caption) label(ctx, el.caption, x, y + h + 10, { size: el.size ?? 18, color: PAL.grey, alpha: p });
  },
  // bar chart. {at, values:[0..1], labels:[], colors:[]}
  bars(ctx, el, t, p) {
    const [x, y] = A(el);
    const bw = el.bw ?? 60, gap = el.gap ?? 34, maxH = el.maxH ?? 220;
    const vals = el.values ?? [];
    const total = vals.length * bw + (vals.length - 1) * gap;
    vals.forEach((v, i) => {
      const bx = x - total / 2 + i * (bw + gap);
      const hh = maxH * clamp01(v) * easeOut(clamp01(p * 1.4 - i * 0.08));
      const red = (el.colors ?? [])[i] === "red";
      ctx.save();
      ctx.globalAlpha = p;
      ctx.fillStyle = red ? "rgba(227,72,90,0.85)" : "rgba(159,221,78,0.8)";
      ctx.shadowColor = red ? PAL.red : PAL.lime;
      ctx.shadowBlur = 12;
      ctx.fillRect(bx, y - hh, bw, hh);
      ctx.restore();
      if (el.labels?.[i]) label(ctx, el.labels[i], bx, y + 12, { size: 18, color: PAL.grey, alpha: p });
    });
    line(ctx, [x - total / 2 - 14, y], [x + total / 2 + 14, y], { stroke: "rgba(237,239,234,0.25)", lw: 1, alpha: p });
  },
  // falling/rising line chart. {at, points:[0..1], w, h, color}
  linechart(ctx, el, t, p) {
    const [x, y] = A(el);
    const w = el.w ?? 360, h = el.h ?? 240;
    const pts = el.points ?? [1, 0.9, 0.75, 0.6, 0.45, 0.3, 0.2, 0.12];
    ctx.save();
    ctx.globalAlpha = p;
    ctx.strokeStyle = el.color ?? PAL.red;
    ctx.shadowColor = el.color ?? PAL.red;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    pts.forEach((v, i) => {
      const px = x - w / 2 + (i / (pts.length - 1)) * w;
      const py = y + h / 2 - v * h;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  },
  // dot field. {at, cols, rows, cell, lit:[indices], litColor}
  dots(ctx, el, t, p) {
    const [x, y] = A(el);
    const cols = el.cols ?? 12, rows = el.rows ?? 7, cell = el.cell ?? 40;
    const lit = el.lit ?? [];
    const total = cols * rows;
    for (let i = 0; i < total; i++) {
      if (i / total > p) break;
      const c = i % cols, r = Math.floor(i / cols);
      const on = lit.includes(i);
      ctx.save();
      ctx.globalAlpha = on ? 1 : 0.16;
      ctx.fillStyle = on ? el.color ?? PAL.lime : PAL.white;
      if (on) {
        ctx.shadowColor = PAL.lime;
        ctx.shadowBlur = 12;
      }
      ctx.beginPath();
      ctx.arc(x - (cols * cell) / 2 + c * cell + cell / 2, y - (rows * cell) / 2 + r * cell + cell / 2, on ? 5 : 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
  // square tile grid. {at, cols, rows, cell, fill}
  tiles(ctx, el, t, p) {
    const [x, y] = A(el);
    const cols = el.cols ?? 8, rows = el.rows ?? 5, cell = el.cell ?? 22, gap = el.gap ?? 3;
    const total = cols * rows;
    ctx.save();
    for (let i = 0; i < total; i++) {
      if (i / total > p) break;
      const c = i % cols, r = Math.floor(i / cols);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = el.fill ?? "rgba(159,221,78,0.5)";
      ctx.fillRect(x - (cols * (cell + gap)) / 2 + c * (cell + gap), y - (rows * (cell + gap)) / 2 + r * (cell + gap), cell, cell);
    }
    ctx.restore();
  },
  // straight connector with an arrow head. {from, to, color, dashed}
  arrow(ctx, el, t, p) {
    const a = el.from ?? [300, 600], b = el.to ?? [420, 640];
    const ex = a[0] + (b[0] - a[0]) * p, ey = a[1] + (b[1] - a[1]) * p;
    const s = el.dash ? [6, 6] : null;
    line(ctx, a, [ex, ey], { stroke: el.color ?? PAL.lime, lw: el.lw ?? 1.6, dash: s, alpha: 0.9, glow: 8 });
    if (p > 0.9) {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const hl = el.head ?? 12;
      ctx.save();
      ctx.strokeStyle = el.color ?? PAL.lime;
      ctx.lineWidth = el.lw ?? 1.6;
      ctx.shadowColor = PAL.lime;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(b[0] - Math.cos(ang - 0.4) * hl, b[1] - Math.sin(ang - 0.4) * hl);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(b[0] - Math.cos(ang + 0.4) * hl, b[1] - Math.sin(ang + 0.4) * hl);
      ctx.stroke();
      ctx.restore();
    }
  },
  // leader line + label next to an object. {at, from, text, size}
  callout(ctx, el, t, p) {
    const [x, y] = A(el);
    const from = el.from ?? [x - 80, y + 60];
    if (p > 0.25) line(ctx, from, [x, y], { stroke: "rgba(159,221,78,0.55)", lw: 1, dash: [4, 4], alpha: p });
    label(ctx, el.text ?? "", x, y - (el.size ?? 22), { size: el.size ?? 22, color: el.color ?? PAL.offWhite, alpha: p });
  },
  // ticking counter. {at, from, to, digits, suffix, size}
  counter(ctx, el, t, p) {
    const [x, y] = A(el);
    const v = (el.from ?? 0) + ((el.to ?? 1) - (el.from ?? 0)) * easeOut(p);
    const txt = (el.prefix ?? "") + Math.round(v).toLocaleString("en-US") + (el.suffix ?? "");
    const size = el.size ?? 30;
    label(ctx, txt, x - labelWidth(txt, size) / 2, y, { size, color: el.color ?? PAL.lime, alpha: 1 });
  },
  // framed panel / screen. {at, w, h, fill}
  panel(ctx, el, t, p) {
    const [x, y] = A(el);
    const w = el.w ?? 260, h = el.h ?? 170;
    panel(ctx, x - w / 2, y - h / 2, w, h, { stroke: el.color ?? PAL.lime, fill: el.fill ?? "rgba(8,14,6,0.92)", alpha: p });
  },
  // connector grid: nodes on an iso lattice. {at, n, step, chip, links}
  lattice(ctx, el, t, p) {
    const [x, y] = A(el);
    const n = el.n ?? 4, step = el.step ?? 100, cs = el.chip ?? 40;
    const nodes = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const dx = ((i - (n - 1) / 2) - (j - (n - 1) / 2)) * 0.866 * step;
        const dy = ((i - (n - 1) / 2) + (j - (n - 1) / 2)) * 0.5 * step;
        nodes.push([x + dx, y + dy]);
      }
    }
    if (el.links !== false) {
      ctx.save();
      ctx.strokeStyle = el.color ?? PAL.lime;
      ctx.globalAlpha = 0.25 * p;
      ctx.lineWidth = 1;
      nodes.forEach((a, k) => nodes.slice(k + 1).forEach((b) => {
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < step * 1.6) {
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
      }));
      ctx.restore();
    }
    nodes.forEach((nd, k) => {
      const ap = clamp01(p * nodes.length - k);
      if (ap <= 0) return;
      chipObj(ctx, { cx: nd[0], cy: nd[1], size: cs, thick: 5, alpha: ap, inner: false, pinCount: 3, glow: 6 });
    });
  },
  // red cross. {at, size}
  cross(ctx, el, t, p) {
    const [x, y] = A(el);
    xMark(ctx, x, y, el.size ?? 40, { alpha: p });
  },
  // lime check mark. {at, size}
  check(ctx, el, t, p) {
    const [x, y] = A(el);
    tick(ctx, x, y, el.size ?? 30, { alpha: p });
  },
};

export const PRIM_NAMES = Object.keys(PRIMS);
