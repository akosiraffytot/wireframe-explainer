// Scene templates: each shot is one of these, plus the shared HUD and caption layer.
import {
  PAL, iso, poly, line, rings, figure, xMark, tick, meter, label, labelWidth,
  dotText, clamp01, lerp, easeOut, seg, chipObj, stackObj, panel,
} from "./index.mjs";
import { measure } from "./dotfont.mjs";
import { PRIMS, reveal } from "./primitives.mjs";

// canvas size, set once by the renderer
let W = 720, H = 1280;
export function setSize(w, h) { W = w; H = h; }

// Helvetica first (closest to the reference), metric-compatible fallbacks for Linux
export const CAPTION_FONT = '"Arial","Helvetica Neue",Helvetica,"Liberation Sans",FreeSans,sans-serif';

// ------------------------------------------------------------------ HUD
export function hud(ctx, chapter, o = {}) {
  const x = 44, y = 52;
  if (!chapter) return;
  if (chapter.badge) dotText(ctx, chapter.badge, x, y, { size: 44, color: PAL.lime, glow: 12 });
  if (chapter.label) dotText(ctx, chapter.label, x, y + 66, { size: 19, color: PAL.offWhite, alpha: 0.92 });
  const n = chapter.of ?? 6;
  const cur = chapter.step ?? 1;
  const tw = 42, th = 6, gap = 10;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.fillStyle = i < cur ? PAL.lime : "rgba(140,145,140,0.28)";
    if (i < cur) {
      ctx.shadowColor = PAL.lime;
      ctx.shadowBlur = 8;
    }
    ctx.fillRect(x + i * (tw + gap), y + 112, tw, th);
    ctx.restore();
  }
}

export function annot(ctx, str, o = {}) {
  if (!str) return;
  const size = o.size ?? 24;
  const w = labelWidth(str, size);
  label(ctx, str, o.x ?? (W - w) / 2, o.y ?? 232, { size, color: o.color ?? PAL.offWhite, alpha: o.alpha ?? 0.9 });
}

// ------------------------------------------------------------------ caption
function drawRichLine(ctx, parts, cx, cy, size, o = {}) {
  // parts: [{text, hi}]
  ctx.save();
  ctx.font = `bold ${size}px ${o.font ?? CAPTION_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const space = ctx.measureText(" ").width;
  let total = 0;
  const widths = parts.map((p) => {
    const w = ctx.measureText(p.text).width + (p.space ? space : 0);
    total += w;
    return w;
  });
  let x = cx - total / 2;
  const y = cy;
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 18;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    ctx.fillStyle = p.hi ? PAL.lime : o.color ?? PAL.white;
    if (p.hi) {
      ctx.shadowColor = "rgba(159,221,78,0.35)";
      ctx.shadowBlur = 22;
    } else {
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 18;
    }
    ctx.fillText(p.text, x, y);
    x += widths[i];
  }
  ctx.restore();
  return total;
}

// split "TWO WORDS" + hi list into coloured parts
function parseLine(raw) {
  if (typeof raw === "string") return { text: raw, hi: [], color: PAL.white };
  return { text: raw.text ?? "", hi: raw.hi ?? [], color: raw.color ?? PAL.white };
}

function lineParts(text, hi) {
  const words = text.split(/\s+/).filter(Boolean);
  const up = (w) => w.replace(/[^A-Z0-9'×$%]/gi, "").toUpperCase();
  const hiSet = new Set(hi.map((h) => up(h)));
  const parts = [];
  words.forEach((w, i) => {
    const isHi = hiSet.has(up(w));
    if (parts.length && parts[parts.length - 1].hi === isHi) parts[parts.length - 1].text += " " + w;
    else parts.push({ text: w, hi: isHi, space: i > 0 });
  });
  return parts;
}

/**
 * Caption layer: lines are shown one at a time across the shot duration.
 * spec.lines = ["ONE LINE", {text:"GREEN LINE", color:"lime"}, {text:"KEY WORD HERE", hi:["KEY"]}]
 */
export function captions(ctx, shot, t, o = {}) {
  const lines = (shot.lines || []).map(parseLine);
  if (!lines.length) return;
  const dur = shot.dur ?? 3;
  const size = shot.captionSize ?? o.size ?? 62;
  // weight each line by character count so short punches stay short
  const weights = lines.map((l) => Math.max(6, l.text.length) ** 0.85);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  let idx = 0, local = 0, span = dur;
  for (let i = 0; i < lines.length; i++) {
    const d = (weights[i] / total) * dur;
    if (t < acc + d || i === lines.length - 1) {
      idx = i; local = t - acc; span = d; break;
    }
    acc += d;
  }
  const l = lines[idx];
  const enter = shot.enter ?? "pop";
  let alpha = 1, scale = 1;
  if (enter === "pop") {
    alpha = seg(local, 0, 0.12);
    scale = lerp(1.06, 1, seg(local, 0, 0.18));
  } else if (enter === "fade") {
    alpha = seg(local, 0, 0.22);
  }

  const rows = l.text.split("\n");
  const step = size * 1.3;
  const bottom = shot.captionBottom ?? H * 0.805;
  const startY = bottom - (rows.length - 1) * step;
  // keyword colour
  const parts = rows.map((r) => lineParts(r, l.hi));
  ctx.save();
  ctx.translate(W / 2, (startY + bottom) / 2);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -(startY + bottom) / 2);
  rows.forEach((r, i) => {
    const p = parts[i];
    if (l.color === "lime") p.forEach((x) => (x.hi = true));
    drawRichLine(ctx, p, W / 2, startY + i * step, size, { alpha });
  });
  ctx.restore();
}

// ------------------------------------------------------------------ scenes
const T = {};

// one chip, optional callouts, rings, rays
T.chip = (ctx, s, t) => {
  const p = s.props ?? {};
  const cx = p.cx ?? W * 0.5, cy = p.cy ?? H * 0.46;
  const size = p.size ?? 250;
  const enter = seg(t, 0, 0.45);
  if (p.rings) rings(ctx, cx, cy + 40, { n: p.rings, r0: size * 0.55, gap: 46, progress: seg(t, 0.15, 1.1), alpha: 0.55 });
  if (p.rays) {
    const rp = seg(t, 0.2, 0.9);
    ctx.save();
    ctx.globalAlpha = 0.5 * rp;
    ctx.strokeStyle = PAL.lime;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + 0.3;
      const r0 = size * 0.55, r1 = r0 + 120 + 90 * (i % 3);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + 20 + Math.sin(a) * r0 * 0.5);
      ctx.lineTo(cx + Math.cos(a) * r1 * rp, cy + 20 + Math.sin(a) * r1 * 0.5 * rp);
      ctx.stroke();
    }
    ctx.restore();
  }
  chipObj(ctx, { cx, cy: cy + (1 - enter) * 14, size, thick: size * 0.075, alpha: enter, glow: 16 });
  if (p.callouts) {
    p.callouts.forEach((c, i) => {
      const cp = seg(t, 0.35 + i * 0.18, 0.75 + i * 0.18);
      if (cp <= 0) return;
      const lx = cx + (c.dx ?? size * 0.55), ly = cy + (c.dy ?? 0);
      label(ctx, c.text, lx, ly, { size: c.size ?? 22, alpha: cp, color: c.color ?? PAL.offWhite });
      if (c.value) label(ctx, c.value, lx, ly + 30, { size: (c.size ?? 22) * 1.1, alpha: cp, color: PAL.lime });
    });
  }
};

// two chips compared, with meters and an optional red separator / ban plane
T.compare = (ctx, s, t) => {
  const p = s.props ?? {};
  const y = p.cy ?? H * 0.44;
  const enter = seg(t, 0, 0.4);
  const left = { x: W * 0.29, y };
  const right = { x: W * 0.71, y: y - 40 };
  const fit = (txt, max = 200) => Math.min(p.labelSize ?? 30, Math.floor(max / (0.857 * Math.max(1, txt.length))));
  const lab = (txt, cx2, cy2) => {
    const sz = fit(txt);
    label(ctx, txt, cx2 - labelWidth(txt, sz) / 2, cy2, { size: sz, color: PAL.offWhite, alpha: enter });
  };
  // red slash between them
  if (p.slash) {
    const sp = seg(t, 0.35, 0.6);
    ctx.save();
    ctx.strokeStyle = PAL.red;
    ctx.lineWidth = 5;
    ctx.shadowColor = PAL.red;
    ctx.shadowBlur = 14;
    ctx.globalAlpha = sp;
    ctx.beginPath();
    ctx.moveTo(left.x + 78, y - 80 + 30 * (1 - sp));
    ctx.lineTo(left.x + 128, y + 40 - 30 * (1 - sp));
    ctx.stroke();
    ctx.restore();
  }
  if (p.grid) {}
  chipObj(ctx, { cx: left.x, cy: left.y, size: p.sizeA ?? 210, thick: 16, alpha: enter, glow: 14 });
  if (p.tower !== false) stackObj(ctx, { cx: right.x, cy: right.y + 150, size: p.sizeB ?? 190, layers: 6, thick: 12, gap: 30, progress: seg(t, 0.1, 0.9), alpha: enter });
  else chipObj(ctx, { cx: right.x, cy: right.y, size: p.sizeB ?? 210, thick: 16, alpha: enter, glow: 14 });
  if (p.labels) {
    lab(p.labels[0], left.x, left.y + 118);
    lab(p.labels[1], right.x, right.y + 216);
  }
  if (p.meters) {
    meter(ctx, left.x - 70, left.y + 152, 140, 18, p.meters[0] ?? 0.35, { alpha: enter });
    meter(ctx, right.x - 70, right.y + 250, 140, 18, p.meters[1] ?? 0.9, { alpha: enter });
    label(ctx, p.meterLabel ?? "SPEED", left.x - 26, left.y + 176, { size: 16, color: PAL.grey, alpha: enter });
    label(ctx, p.meterLabel ?? "SPEED", right.x - 26, right.y + 274, { size: 16, color: PAL.grey, alpha: enter });
  }
  if (p.ban) {
    const bp = seg(t, 0.5, 1.2);
    const bw = 150, bh = 120;
    const q = [
      [right.x - bw / 2 - 40, right.y - 40],
      [right.x - bw / 2 + 20, right.y - 100],
      [right.x + bw / 2 - 20, right.y - 20],
      [right.x + bw / 2 - 80, right.y + 40],
    ];
    poly(ctx, q, { fill: "rgba(227,72,90,0.22)", stroke: PAL.red, alpha: bp * 0.9, lw: 1.4, glow: 12 });
    label(ctx, p.ban, right.x - labelWidth(p.ban, 20) / 2, right.y - 150, { size: 20, color: PAL.red, alpha: bp });
  }
};

// a tower of layers assembling on the stage
T.stack = (ctx, s, t) => {
  const p = s.props ?? {};
  const cx = p.cx ?? W * 0.5, cy = p.cy ?? H * 0.5;
  stackObj(ctx, { cx, cy: cy + 90, size: p.size ?? 230, layers: p.layers ?? 6, thick: 12, gap: p.gap ?? 30, progress: seg(t, 0.1, 0.8) });
  (p.callouts ?? []).forEach((c, i) => {
    const cp = seg(t, 0.5 + i * 0.15, 0.8 + i * 0.15);
    label(ctx, c.text, cx + (c.dx ?? 150), cy + 60 - i * (p.gap ?? 30) - (c.dy ?? 0), { size: 20, alpha: cp, color: c.color });
  });
};

// grid of small glyphs, some lit (startups / developers / survivors)
T.grid = (ctx, s, t) => {
  const p = s.props ?? {};
  const cols = p.cols ?? 14, rows = p.rows ?? 10;
  const cw = p.cell ?? 34;
  const x0 = W / 2 - (cols * cw) / 2 + cw / 2;
  const y0 = (p.y ?? H * 0.33);
  const total = cols * rows;
  const litN = p.litCount ?? 2;
  const lit = p.lit ?? Array.from({ length: litN }, (_, i) => (i * 37) % total);
  const cp = seg(t, 0.05, 0.55);
  ctx.save();
  for (let i = 0; i < total; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const appears = i / total < cp ? 1 : 0;
    if (!appears) continue;
    const isLit = lit.includes(i);
    const x = x0 + c * cw, y = y0 + r * cw;
    const glowOn = isLit ? seg(t, 0.5, 0.8) : 0;
    ctx.globalAlpha = isLit ? 0.3 + 0.7 * glowOn : 0.2;
    ctx.fillStyle = isLit ? PAL.lime : PAL.white;
    if (isLit) {
      ctx.shadowColor = PAL.lime;
      ctx.shadowBlur = 14 * glowOn;
    }
    ctx.beginPath();
    ctx.arc(x, y, isLit ? 6 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (p.counter) {
    const v = p.counter.from + (p.counter.to - p.counter.from) * easeOut(seg(t, 0.2, 1.6));
    const txt = Math.round(v).toLocaleString("en-US");
    const sz = p.counter.size ?? 30;
    label(ctx, txt, W / 2 - labelWidth(txt, sz) / 2, y0 + rows * cw + 24, { size: sz, color: PAL.lime });
  }
};

// bars or a line chart
T.chart = (ctx, s, t) => {
  const p = s.props ?? {};
  const cx = W * 0.5, base = H * 0.62;
  const ep = seg(t, 0.1, 0.8);
  if (p.type === "line") {
    const n = p.points?.length ?? 8;
    const arr = p.points ?? Array.from({ length: n }, (_, i) => 1 - i / (n - 1));
    const w = 380, hgt = 260;
    ctx.save();
    ctx.strokeStyle = PAL.red;
    ctx.shadowColor = PAL.red;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    arr.forEach((v, i) => {
      const x = cx - w / 2 + (i / (arr.length - 1)) * w;
      const y = base - 60 - v * hgt;
      if (i === 0) ctx.moveTo(x, y);
      else if (i / arr.length <= ep) ctx.lineTo(x, y);
    });
    ctx.stroke();
    // dashed projection
    if (p.dashTo != null) {
      ctx.setLineDash([6, 6]);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      const lastX = cx - w / 2 + w, lastY = base - 60 - arr[arr.length - 1] * hgt;
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(lastX + 60, base - 60 - p.dashTo * hgt);
      ctx.stroke();
    }
    ctx.restore();
    if (p.tag) {
      const txt = typeof p.tag === "string" ? p.tag : `${(p.tagFrom ?? 20).toFixed(1)}B`;
      label(ctx, txt, cx + 200 + 8, base - 60 - arr[arr.length - 1] * hgt - 10, { size: 26, color: PAL.red });
    }
  }
  if (p.bars) {
    const bw = 70, gap = 48;
    const totalW = p.bars.length * bw + (p.bars.length - 1) * gap;
    line(ctx, [cx - totalW / 2 - 20, base], [cx + totalW / 2 + 20, base], { stroke: "rgba(237,239,234,0.25)", lw: 1 });
    p.bars.forEach((b, i) => {
      const x = cx - totalW / 2 + i * (bw + gap);
      const bpH = seg(t, 0.15 + i * 0.12, 0.7 + i * 0.12);
      const hh = b.v * 250 * bpH;
      ctx.save();
      ctx.fillStyle = b.color === "red" ? "rgba(227,72,90,0.85)" : "rgba(159,221,78,0.75)";
      ctx.shadowColor = b.color === "red" ? PAL.red : PAL.lime;
      ctx.shadowBlur = 14;
      ctx.fillRect(x, base - hh, bw, hh);
      ctx.restore();
      if (b.label) label(ctx, b.label, x, base + 14, { size: 18, color: PAL.grey });
    });
  }
};

// a road in perspective: converges from the near bottom-left to a far end, walker on it
T.road = (ctx, s, t) => {
  const p = s.props ?? {};
  const A0 = [p.x0 ?? -60, p.y0 ?? H * 0.92];
  const A1 = [p.x1 ?? W * 1.06, p.y1 ?? H * 0.30];
  const w0 = p.width ?? 150, w1 = p.widthFar ?? 92;
  const n = p.cells ?? 14;
  const dx = A1[0] - A0[0], dy = A1[1] - A0[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const at = (k, side) => {
    const c = [A0[0] + dx * k, A0[1] + dy * k];
    const hw = (w0 * (1 - k) + w1 * k) / 2;
    return [c[0] + nx * hw * side, c[1] + ny * hw * side];
  };
  for (let i = 0; i < n; i++) {
    const k0 = i / n, k1 = (i + 1) / n;
    const q = [at(k0, -1), at(k0, 1), at(k1, 1), at(k1, -1)];
    poly(ctx, q, { stroke: PAL.lime, fill: null, lw: 1, alpha: 0.15 + 0.55 * (1 - k0) });
    if (i % 2 === 0) {
      const d0 = at(k0 + (k1 - k0) * 0.3, 0), d1 = at(k0 + (k1 - k0) * 0.7, 0);
      line(ctx, d0, d1, { stroke: PAL.offWhite, lw: 1 + 1.8 * (1 - k0), alpha: 0.75 });
    }
  }
  if (p.walker !== false) {
    const drift = (p.walk ?? 1) * seg(t, 0, s.dur ?? 3);
    const k = (p.at ?? 0.1) + drift * (p.travel ?? 0.32);
    const wpt = at(k, 0);
    const fh = p.figureH ?? 70;
    figure(ctx, wpt[0], wpt[1] - fh, fh, { stride: t * 7, color: PAL.white, alpha: 0.95 });
  }
  (p.tags ?? []).forEach((tag, i) => {
    const cp = seg(t, 0.2 + i * 0.2, 0.5 + i * 0.2);
    const k = tag.at ?? 0.4 + i * 0.25;
    const q = at(k, tag.side ?? 1);
    const tx = q[0] + (tag.dx ?? 0), ty = q[1] + (tag.dy ?? 0);
    const sz = tag.size ?? 30;
    label(ctx, tag.text, tx - labelWidth(tag.text, sz) / 2, ty, { size: sz, color: tag.color ?? PAL.lime, alpha: cp });
  });
};

// pixel matrix repainting
T.pixels = (ctx, s, t) => {
  const p = s.props ?? {};
  const cols = p.cols ?? 26, rows = p.rows ?? 12, cell = p.cell ?? 15;
  const x0 = W / 2 - (cols * cell) / 2, y0 = H * 0.36;
  const cp = seg(t, 0.05, 0.5);
  ctx.save();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = (r * cols + c) / (cols * rows);
      if (k > cp) continue;
      const on = ((r * 7 + c * 13) % 5) > 1;
      ctx.globalAlpha = on ? 0.85 : 0.18;
      ctx.fillStyle = on ? PAL.lime : PAL.green;
      ctx.fillRect(x0 + c * cell + 1, y0 + r * cell + 1, cell - 2, cell - 2);
    }
  }
  ctx.restore();
  if (p.sweep) {
    const sp = seg(t, 0.4, 2.4);
    const sx = x0 + sp * cols * cell;
    ctx.save();
    const g = ctx.createLinearGradient(sx - 30, 0, sx + 10, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.7, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(sx - 30, y0, 40, rows * cell);
    ctx.restore();
  }
  if (p.counter) {
    const v = p.counter.to ?? 2073600;
    const txt = Math.round(v * easeOut(seg(t, 0.1, 1.4))).toLocaleString("en-US");
    label(ctx, txt, W / 2 - labelWidth(txt, 26) / 2, y0 + rows * cell + 22, { size: 26, color: PAL.offWhite });
  }
};

// isometric lattice of connected chips
T.lattice = (ctx, s, t) => {
  const p = s.props ?? {};
  const n = p.n ?? 5, step = p.step ?? 92;
  const cx = W * 0.5, cy = H * 0.5;
  const cp = seg(t, 0.05, 0.7);
  const nodes = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const [dx, dy] = iso((i - (n - 1) / 2) * step, (j - (n - 1) / 2) * step, 0);
      nodes.push({ x: cx + dx, y: cy + dy, i, j });
    }
  }
  // links
  ctx.save();
  ctx.strokeStyle = PAL.lime;
  ctx.globalAlpha = 0.28 * cp;
  ctx.lineWidth = 1;
  nodes.forEach((a, k) => {
    nodes.slice(k + 1).forEach((b) => {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < step * 1.6) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    });
  });
  ctx.restore();
  nodes.forEach((nd, k) => {
    const ap = clamp01(cp * nodes.length - k);
    if (ap <= 0) return;
    const s2 = (p.chipSize ?? 34) * ap;
    chipObj(ctx, { cx: nd.x, cy: nd.y, size: s2, thick: 5, yaw: Math.PI / 4, alpha: 0.95, glow: 8, inner: false, pinCount: 3 });
  });
  if (p.counter) {
    const v = p.counter.from + (p.counter.to - p.counter.from) * easeOut(seg(t, 0.3, 2.2));
    label(ctx, `$${v.toFixed(1)}B`, W / 2 - 40, H * 0.78, { size: 26, color: PAL.lime });
  }
};

// server rack: an isometric cabinet with a grid of GPU blocks and red cable curves
T.rack = (ctx, s, t) => {
  const p = s.props ?? {};
  const cx = p.cx ?? W * 0.5, cy = p.cy ?? H * 0.5;
  const cols = p.cols ?? 4, rows = p.rows ?? 7, cell = p.cell ?? 46;
  const fw = cols * cell, fh = rows * cell;
  const dx = 46, dy = -26; // cabinet depth
  const FTL = [cx - fw / 2, cy - fh / 2], FTR = [cx + fw / 2, cy - fh / 2];
  const FBL = [cx - fw / 2, cy + fh / 2], FBR = [cx + fw / 2, cy + fh / 2];
  const sh = (q) => [q[0] + dx, q[1] + dy];
  poly(ctx, [FTL, sh(FTL), sh(FTR), FTR], { fill: "#0d1a09", stroke: PAL.lime, alpha: 0.95, lw: 1.2 });
  poly(ctx, [FTR, sh(FTR), sh(FBR), FBR], { fill: "#08120a", stroke: PAL.lime, alpha: 0.95, lw: 1.2 });
  panel(ctx, FTL[0], FTL[1], fw, fh, { fill: "rgba(8,14,6,0.94)", stroke: PAL.lime });
  const cp = seg(t, 0.05, 0.6);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = (r * cols + c) / (rows * cols);
      if (k > cp) continue;
      const x = FTL[0] + 6 + c * cell, y = FTL[1] + 6 + r * cell;
      ctx.save();
      ctx.fillStyle = "rgba(159,221,78,0.5)";
      ctx.shadowColor = PAL.lime;
      ctx.shadowBlur = 9;
      ctx.fillRect(x, y, cell - 12, cell - 13);
      ctx.restore();
    }
  }
  if (p.cables !== false) {
    const cg = seg(t, 0.4, 1.2);
    ctx.save();
    ctx.strokeStyle = "rgba(200,90,60,0.9)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#C85A3C";
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.9 * cg;
    for (let i = 0; i < 7; i++) {
      const y = FTL[1] + (i + 0.5) * (fh / 7);
      ctx.beginPath();
      ctx.moveTo(FTL[0] + 3, y);
      ctx.bezierCurveTo(FTL[0] - 26, y + 8, FTL[0] - 20, y + 30, FTL[0] - 56, y + 36);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (p.glowStrip) {
    ctx.save();
    const g = ctx.createLinearGradient(FTL[0], 0, FTR[0], 0);
    g.addColorStop(0, "rgba(159,221,78,0)");
    g.addColorStop(0.5, "rgba(159,221,78,0.3)");
    g.addColorStop(1, "rgba(159,221,78,0)");
    ctx.fillStyle = g;
    ctx.fillRect(FTL[0], FTL[1] + fh * 0.44, fw, fh * 0.1);
    ctx.restore();
  }
};

// icon row with ticks and crosses
T.icons = (ctx, s, t) => {
  const p = s.props ?? {};
  const items = p.items ?? [];
  const n = items.length;
  const cw = 76, gap = 14;
  const totalW = n * cw + (n - 1) * gap;
  const y = p.y ?? H * 0.44;
  items.forEach((it, i) => {
    const ap = seg(t, 0.05 + i * 0.07, 0.4 + i * 0.07);
    if (ap <= 0) return;
    const x = W / 2 - totalW / 2 + i * (cw + gap);
    ctx.save();
    ctx.globalAlpha = ap;
    panel(ctx, x, y, cw, cw, { stroke: it.state === "no" ? "rgba(227,72,90,0.7)" : "rgba(159,221,78,0.7)", fill: "rgba(10,18,7,0.7)" });
    ctx.restore();
    const icx = x + cw / 2, icy = y + cw / 2;
    if (it.kind === "box") {
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.fillStyle = "rgba(237,239,234,0.75)";
        ctx.fillRect(icx - 18, icy - 14 + k * 12, 36, 6);
        ctx.restore();
      }
    } else if (it.kind === "gpu") {
      chipObj(ctx, { cx: icx, cy: icy + 6, size: 34, thick: 5, alpha: ap, inner: false, pinCount: 3, glow: 6 });
    } else if (it.kind === "dot") {
      ctx.save();
      ctx.fillStyle = PAL.offWhite;
      ctx.beginPath();
      ctx.arc(icx, icy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (it.state === "no") xMark(ctx, x + cw - 12, y + 12, 18, { lw: 2.4, alpha: ap });
    if (it.state === "yes") tick(ctx, x + cw - 12, y + 12, 20, { alpha: ap });
  });
};

// CRT monitor with typed screen content
T.monitor = (ctx, s, t) => {
  const p = s.props ?? {};
  const cx = p.cx ?? W * 0.5, cy = p.cy ?? H * 0.45;
  const w = p.w ?? 300, h = p.h ?? 220;
  const ch = seg(t, 0.05, 0.4);
  ctx.save();
  ctx.globalAlpha = ch;
  panel(ctx, cx - w / 2, cy - h / 2, w, h, { fill: "rgba(8,14,6,0.94)", stroke: PAL.lime, lw: 1.4 });
  // scanline
  ctx.globalAlpha = ch * 0.25;
  for (let y = cy - h / 2 + 4; y < cy + h / 2; y += 4) {
    ctx.fillStyle = "rgba(159,221,78,0.25)";
    ctx.fillRect(cx - w / 2 + 3, y, w - 6, 1);
  }
  ctx.globalAlpha = ch;
  // stand
  ctx.strokeStyle = PAL.lime;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy + h / 2);
  ctx.lineTo(cx - 34, cy + h / 2 + 46);
  ctx.lineTo(cx + 34, cy + h / 2 + 46);
  ctx.lineTo(cx + 26, cy + h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 48, cy + h / 2 + 56);
  ctx.lineTo(cx + 48, cy + h / 2 + 56);
  ctx.stroke();
  ctx.restore();
  if (p.screen) {
    const tp = Math.max(0, t - 0.45);
    const chars = Math.floor(tp * 26);
    const visible = p.screen.slice(0, chars).toUpperCase();
    const rowsAll = p.screen.toUpperCase().split("\n");
    const longest = Math.max(...rowsAll.map((r) => r.length), 1);
    // fit the dot text inside the screen: 0.857*size*len <= w-36
    const size = Math.min(p.screenSize ?? 26, Math.floor((w - 36) / (longest * 0.857)));
    visible.split("\n").forEach((ln, i) => {
      label(ctx, ln, cx - labelWidth(ln, size) / 2, cy - h / 2 + 26 + i * (size * 1.5), { size, color: PAL.offWhite });
    });
    if (chars < p.screen.length && Math.floor(t * 4) % 2 === 0) {
      const lastRow = visible.split("\n").pop();
      const cxx = cx + labelWidth(lastRow, size) / 2 + 8;
      const cyy = cy - h / 2 + 26 + (visible.split("\n").length - 1) * (size * 1.5);
      ctx.save();
      ctx.fillStyle = PAL.lime;
      ctx.fillRect(cxx, cyy, size * 0.5, size * 0.9);
      ctx.restore();
    }
  }
  if (p.eye) {
    const ep = seg(t, 0.6, 1.1);
    const eyeY = cy + (p.screen ? h * 0.22 : 10);
    ctx.save();
    ctx.strokeStyle = PAL.lime;
    ctx.lineWidth = 2;
    ctx.shadowColor = PAL.lime;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = ep;
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, 62 * ep, 34 * ep, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, eyeY, 14 * ep, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
};

// wall of code / list text
T.textwall = (ctx, s, t) => {
  const p = s.props ?? {};
  const cols = p.cols ?? 3, rows = p.rows ?? 16;
  const x0 = W * 0.5 - (cols * 210) / 2, y0 = H * 0.26;
  const cp = seg(t, 0.05, 0.7);
  const words = p.words ?? ["NVLINK", "TENSOR CORE", "CUDA", "HBM", "NVSWITCH", "PTX", "CUTLASS", "TRITON", "CUDNN", "TMA", "FP8", "GRACE"];
  ctx.save();
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const k = (c * rows + r) / (cols * rows);
      if (k > cp) continue;
      const w = words[(c * 7 + r * 3) % words.length];
      ctx.globalAlpha = 0.35 + 0.5 * ((c * 13 + r * 7) % 5) / 4;
      dotText(ctx, w, x0 + c * 214, y0 + r * 30, { size: 14, color: PAL.lime });
    }
  }
  ctx.restore();
  if (p.big) {
    const v = Math.round(p.big.from + (p.big.to - p.big.from) * easeOut(seg(t, 0.2, 1.4)));
    const txt = String(v);
    label(ctx, txt, W / 2 - labelWidth(txt, 56) / 2, H * 0.7, { size: 56, color: PAL.offWhite });
  }
};

// stick figures: one, a crowd, a queue, a hand-off
T.people = (ctx, s, t) => {
  const p = s.props ?? {};
  const groundY = p.y ?? H * 0.56;
  const n = p.count ?? 1;
  const h = p.h ?? 110;
  if (p.queue) {
    // a column of box glyphs next to the figure
    const x = W * 0.5 + 40;
    for (let i = 0; i < 9; i++) {
      const ap = seg(t, 0.05 + i * 0.05, 0.4 + i * 0.05);
      ctx.save();
      ctx.globalAlpha = ap * 0.9;
      ctx.strokeStyle = PAL.lime;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x, groundY - h * 0.9 + i * 26, 44, 20);
      ctx.restore();
    }
    figure(ctx, W * 0.5 - 60, groundY - h, h, { stride: t * 2, color: PAL.white });
  } else if (p.handoff) {
    const walk = seg(t, 0.1, 1.6);
    const fx = lerp(W * 0.18, W * 0.62, walk);
    figure(ctx, fx, groundY - h, h, { stride: t * 8, color: PAL.white });
    // carried crate
    ctx.save();
    ctx.strokeStyle = PAL.lime;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = PAL.lime;
    ctx.shadowBlur = 12;
    ctx.strokeRect(fx + h * 0.16, groundY - h * 0.55, 46, 34);
    ctx.restore();
    figure(ctx, W * 0.82, groundY - h * 0.92, h * 0.92, { arms: "out", color: PAL.offWhite, alpha: 0.85 });
  } else {
    for (let i = 0; i < n; i++) {
      const ap = seg(t, 0.05 + i * 0.1, 0.4 + i * 0.1);
      const x = W / 2 + (i - (n - 1) / 2) * (h * 0.85);
      figure(ctx, x, groundY - h, h, { stride: t * 2 + i, color: PAL.white, alpha: ap });
    }
  }
  if (p.tag) {
    const tw = labelWidth(p.tag, 22);
    label(ctx, p.tag, W / 2 - tw / 2, groundY + 26, { size: 22, color: PAL.offWhite });
  }
};

// a few lit dots on black (survivors, headcount cut)
T.dots = (ctx, s, t) => {
  const p = s.props ?? {};
  const cols = p.cols ?? 12, rows = p.rows ?? 7, cell = p.cell ?? 46;
  const x0 = W / 2 - (cols * cell) / 2, y0 = H * 0.36;
  const total = cols * rows;
  const lit = p.lit ?? [3, 9];
  const fade = p.fade ?? 0.4;
  ctx.save();
  for (let i = 0; i < total; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const isLit = lit.includes(i);
    const dimAt = seg(t, fade, fade + 0.8);
    ctx.globalAlpha = isLit ? 1 : lerp(0.16, 0.05, dimAt);
    ctx.fillStyle = isLit ? PAL.lime : PAL.white;
    if (isLit) {
      ctx.shadowColor = PAL.lime;
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.arc(x0 + c * cell + cell / 2, y0 + r * cell + cell / 2, isLit ? 5 : 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

// empty beat / year card
T.card = (ctx, s, t) => {
  const p = s.props ?? {};
  const ap = seg(t, 0, 0.35);
  if (p.big) {
    const sz = p.bigSize ?? 60;
    const w = measure(p.big.toUpperCase(), sz / 7);
    dotText(ctx, p.big, (W - w) / 2, H * 0.42, { size: sz, color: p.color ?? PAL.offWhite, alpha: ap, glow: 16 });
  }
  if (p.frame) {
    ctx.save();
    ctx.globalAlpha = ap * 0.5;
    ctx.strokeStyle = PAL.lime;
    ctx.strokeRect(W * 0.5 - 80, H * 0.44, 160, 120);
    ctx.restore();
  }
};

// ------------------------------------------------------------------ compose
// A scene assembled from primitives, for shots no fixed template covers.
// props.elements = [{ prim, at:[x,y], t0, reveal, ...props }] — draw order = array order.
T.compose = (ctx, s, t) => {
  const els = s.props?.elements ?? [];
  for (const el of els) {
    const prim = PRIMS[el.prim];
    if (!prim) continue; // check.mjs reports unknown primitives
    const p = el.static ? 1 : reveal(t, el);
    if (p <= 0) continue;
    prim(ctx, el, t, p);
  }
};

export const templates = T;
