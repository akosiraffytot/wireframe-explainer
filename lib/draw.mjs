// Drawing kit for the green-wireframe explainer look.
// Everything is isometric (2:1), one lime accent, glow instead of shading.

import { dotText, measure } from "./dotfont.mjs";

export const PAL = {
  bg: "#040605",
  bgGlow: "#0d1a08",
  lime: "#9FDD4E",
  limeDim: "#6F9B3C",
  green: "#2E451F",
  greenLine: "rgba(159,221,78,0.20)",
  white: "#FFFFFF",
  offWhite: "#EDEFEA",
  grey: "#8C918C",
  greyDim: "#4C514C",
  red: "#E3485A",
  redDim: "#7A2530",
  ink: "#0A1207",
};

// ---------- timing ----------
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => {
  const c = 1.70158, x = clamp01(t);
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
// progress of t inside [a,b] as 0..1 (already eased-out)
export const seg = (t, a, b, ease = easeOut) => ease(clamp01((t - a) / Math.max(1e-6, b - a)));

// ---------- canvas ----------
// (the renderer creates the canvas with @napi-rs/canvas and passes the ctx in)

// ---------- background ----------
export function background(ctx, W, H, o = {}) {
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, Math.max(W, H) * 0.72);
  g.addColorStop(0, o.glowStrong ? "#16260d" : PAL.bgGlow);
  g.addColorStop(0.55, "rgba(10,20,6,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// isometric ground grid, fading out towards the edges
export function isoGrid(ctx, W, H, o = {}) {
  const cx = o.cx ?? W * 0.5;
  const cy = o.cy ?? H * 0.6;
  const cell = o.cell ?? 58;
  const n = o.n ?? 16;
  const alpha = o.alpha ?? 0.18;
  const drift = o.drift ?? 0;
  const span = cell * n * 1.8;
  const d1 = [0.866, 0.5];
  const d2 = [0.866, -0.5];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = PAL.greenLine;
  ctx.lineWidth = 1;
  for (let i = -n; i <= n; i++) {
    const u = i * cell + (drift % cell);
    const fade = Math.max(0, 1 - Math.abs(i) / (n + 1));
    ctx.globalAlpha = alpha * fade;
    const ax = u * d2[0], ay = u * d2[1];
    ctx.beginPath();
    ctx.moveTo(ax - span * d1[0], ay - span * d1[1]);
    ctx.lineTo(ax + span * d1[0], ay + span * d1[1]);
    const bx = u * d1[0], by = u * d1[1];
    ctx.moveTo(bx - span * d2[0], by - span * d2[1]);
    ctx.lineTo(bx + span * d2[0], by + span * d2[1]);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- iso helpers ----------
// 3D (x right, y away, z up) -> screen offset from the scene anchor
export function iso(x, y, z = 0, k = 1) {
  return [(x - y) * 0.866 * k, ((x + y) * 0.5 - z) * k];
}
export function at(anchor, p) {
  return [anchor[0] + p[0], anchor[1] + p[1]];
}

export function poly(ctx, pts, o = {}) {
  if (!pts.length) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (o.fill) {
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.fillStyle = o.fill;
    ctx.fill();
  }
  if (o.stroke !== null) {
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.strokeStyle = o.stroke ?? PAL.lime;
    ctx.lineWidth = o.lw ?? 1.4;
    if (o.dash) ctx.setLineDash(o.dash);
    if (o.glow) {
      ctx.shadowColor = o.stroke ?? PAL.lime;
      ctx.shadowBlur = o.glow;
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function line(ctx, a, b, o = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = o.stroke ?? PAL.lime;
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.lineWidth = o.lw ?? 1.2;
  if (o.dash) ctx.setLineDash(o.dash);
  if (o.glow) {
    ctx.shadowColor = o.stroke ?? PAL.lime;
    ctx.shadowBlur = o.glow;
  }
  ctx.stroke();
  ctx.restore();
}

// a 4-corner square on the ground/top plane, rotated by yaw, extruded by thick
export function slab(ctx, o) {
  const { cx, cy, a, thick = 10, yaw = 0, rotFace = 0 } = o;
  const k = 1;
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const ang = yaw + Math.PI / 4 + (i * Math.PI) / 2;
    pts.push([Math.cos(ang) * a * Math.SQRT2 * 0.5, Math.sin(ang) * a * Math.SQRT2 * 0.5]);
  }
  const top = pts.map(([x, y]) => {
    const [dx, dy] = iso(x, y, thick);
    return [cx + dx, cy + dy];
  });
  const bot = pts.map(([x, y]) => {
    const [dx, dy] = iso(x, y, 0);
    return [cx + dx, cy + dy];
  });
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const mid = [(pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2];
    faces.push({ d: mid[0] + mid[1], q: [bot[i], bot[j], top[j], top[i]] });
  }
  faces.sort((p, q) => p.d - q.d);
  for (const f of faces) {
    poly(ctx, f.q, {
      fill: o.fill ?? PAL.ink,
      stroke: o.stroke ?? PAL.lime,
      alpha: o.alpha ?? 1,
      lw: o.lw ?? 1.3,
      glow: o.glow,
    });
  }
  poly(ctx, top, {
    fill: o.fill ?? PAL.ink,
    stroke: o.stroke ?? PAL.lime,
    alpha: o.alpha ?? 1,
    lw: o.lw ?? 1.3,
    glow: o.glow,
  });
  return { top, bot, pts };
}

// pin ticks on the two near edges of a chip
export function pins(ctx, o) {
  const { cx, cy, a, thick = 10, n = 7, len = 0.26, yaw = 0, color = PAL.lime, alpha = 1 } = o;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.2;
  for (let side = 0; side < 2; side++) {
    const ang = yaw + Math.PI / 4 + (side * Math.PI) / 2;
    const ex = Math.cos(ang), ey = Math.sin(ang);
    const px = -Math.sin(ang), py = Math.cos(ang);
    for (let i = 1; i <= n; i++) {
      const s = (i / (n + 1) - 0.5) * a * Math.SQRT2;
      const bx = ex * a * Math.SQRT2 * 0.5 + px * s;
      const by = ey * a * Math.SQRT2 * 0.5 + py * s;
      const ax = bx + ex * len * a, ay = by + ey * len * a;
      const p1 = iso(bx, by, 0), p2 = iso(ax, ay, 0);
      ctx.beginPath();
      ctx.moveTo(cx + p1[0], cy + p1[1]);
      ctx.lineTo(cx + p2[0], cy + p2[1]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// concentric iso rings (the "moat")
export function rings(ctx, cx, cy, o = {}) {
  const { n = 3, r0 = 46, gap = 26, ratio = 0.5, progress = 1, color = PAL.lime, alpha = 0.9, lw = 1.6, glow = 14 } = o;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  for (let i = 0; i < n; i++) {
    const p = clamp01(progress * n - i);
    if (p <= 0) continue;
    const r = r0 + i * gap;
    const end = Math.PI * 2 * p;
    ctx.globalAlpha = alpha * (1 - i * 0.16);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * ratio, 0, -Math.PI / 2, -Math.PI / 2 + end);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- pictograms ----------
export function figure(ctx, x, y, h, o = {}) {
  const { color = PAL.white, alpha = 1, stride = 0, lean = 0, arms = "down" } = o;
  const head = h * 0.21;
  const bodyH = h * 0.4;
  const lw = Math.max(2.5, h * 0.085);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const hipY = y + head + bodyH * 0.95;
  // head
  ctx.beginPath();
  ctx.arc(x, y + head / 2, head / 2, 0, Math.PI * 2);
  ctx.fill();
  // torso
  ctx.beginPath();
  ctx.moveTo(x, y + head);
  ctx.lineTo(x + lean * h * 0.05, hipY);
  ctx.stroke();
  // legs (always spread a little so the pose reads as a person)
  const sw = h * 0.085 + Math.sin(stride) * h * 0.075;
  ctx.beginPath();
  ctx.moveTo(x + lean * h * 0.05, hipY);
  ctx.lineTo(x + sw, y + h);
  ctx.moveTo(x + lean * h * 0.05, hipY);
  ctx.lineTo(x - sw, y + h);
  ctx.stroke();
  // arms
  const ay = y + head + bodyH * 0.35;
  if (arms === "carry") {
    ctx.beginPath();
    ctx.moveTo(x, ay);
    ctx.lineTo(x + h * 0.16, ay + h * 0.06);
    ctx.stroke();
  } else if (arms === "out") {
    ctx.beginPath();
    ctx.moveTo(x, ay);
    ctx.lineTo(x - h * 0.14, ay - h * 0.06);
    ctx.moveTo(x, ay);
    ctx.lineTo(x + h * 0.14, ay - h * 0.06);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, ay);
    ctx.lineTo(x - sw * 0.5, ay + h * 0.2);
    ctx.moveTo(x, ay);
    ctx.lineTo(x + sw * 0.5, ay + h * 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

export function xMark(ctx, x, y, s, o = {}) {
  const color = o.color ?? PAL.red;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = o.lw ?? 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = o.glow ?? 10;
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.beginPath();
  ctx.moveTo(x - s / 2, y - s / 2);
  ctx.lineTo(x + s / 2, y + s / 2);
  ctx.moveTo(x + s / 2, y - s / 2);
  ctx.lineTo(x - s / 2, y + s / 2);
  ctx.stroke();
  ctx.restore();
}

export function tick(ctx, x, y, s, o = {}) {
  const color = o.color ?? PAL.lime;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = o.lw ?? 2.2;
  ctx.shadowColor = color;
  ctx.shadowBlur = o.glow ?? 8;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.4, y);
  ctx.lineTo(x - s * 0.05, y + s * 0.35);
  ctx.lineTo(x + s * 0.45, y - s * 0.4);
  ctx.stroke();
  ctx.restore();
}

export function meter(ctx, x, y, w, h, p, o = {}) {
  const color = o.color ?? PAL.lime;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.strokeStyle = o.stroke ?? "rgba(237,239,234,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * clamp01(p)), h - 4);
  ctx.restore();
}

// small mono-ish label in the dot font
export function label(ctx, str, x, y, o = {}) {
  return dotText(ctx, str, x, y, {
    size: o.size ?? 22,
    color: o.color ?? PAL.offWhite,
    alpha: o.alpha ?? 1,
    glow: o.glow,
  });
}
export function labelWidth(str, size = 22) {
  const pitch = (size / 7) * 1.36;
  return measure(String(str).toUpperCase(), pitch);
}

// ---------- 3D props ----------
// A chip die: a screen-space rhombus with thickness, an inset die area and pin ticks
// on the two near edges. `size` is the width of the rhombus in px.
export function chipObj(ctx, o) {
  const {
    cx, cy, size = 240, thick = 16, alpha = 1, fill = PAL.ink, stroke = PAL.lime,
    glow = 12, inner = true, pinCount = 7, pinLen = 9, squash = 0.56,
  } = o;
  const hw = size / 2, hh = (size * squash) / 2;
  const A = [cx - hw, cy], B = [cx, cy - hh], C = [cx + hw, cy], D = [cx, cy + hh];
  ctx.save();
  ctx.globalAlpha = alpha;
  // pin ticks, before the body so they tuck under the edge
  if (pinCount > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.shadowColor = stroke;
    ctx.shadowBlur = glow * 0.6;
    const edges = [
      { from: A, to: D, n: [-hh, hw] },
      { from: D, to: C, n: [hh, hw] },
    ];
    for (const e of edges) {
      const ex = e.to[0] - e.from[0], ey = e.to[1] - e.from[1];
      const len = Math.hypot(ex, ey);
      const nx = e.n[0] / Math.hypot(e.n[0], e.n[1]), ny = e.n[1] / Math.hypot(e.n[0], e.n[1]);
      for (let i = 1; i <= pinCount; i++) {
        const s = i / (pinCount + 1);
        const px = e.from[0] + ex * s, py = e.from[1] + ey * s;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + nx * pinLen, py + ny * pinLen);
        ctx.stroke();
      }
    }
  }
  // thickness: two near side faces
  ctx.shadowBlur = 0;
  poly(ctx, [[A[0], A[1]], [D[0], D[1]], [D[0], D[1] + thick], [A[0], A[1] + thick]], { fill, stroke, alpha, lw: 1.2 });
  poly(ctx, [[D[0], D[1]], [C[0], C[1]], [C[0], C[1] + thick], [D[0], D[1] + thick]], { fill, stroke, alpha, lw: 1.2 });
  // top face
  poly(ctx, [A, B, C, D], { fill, stroke, alpha, lw: 1.4, glow });
  if (inner) {
    const k = 0.5;
    poly(
      ctx,
      [A, B, C, D].map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]),
      { fill: "rgba(159,221,78,0.05)", stroke, alpha: alpha * 0.85, lw: 1 },
    );
  }
  ctx.restore();
  return { cx, cy, hw, hh };
}

export function stackObj(ctx, o) {
  const { cx, cy, size = 220, layers = 6, thick = 12, gap = 26, alpha = 1, progress = 1 } = o;
  // draw bottom layer first, then upwards; the stack sits on `cy` as its bottom tip
  for (let i = 0; i < layers; i++) {
    const local = clamp01(progress * layers - i);
    if (local <= 0) continue;
    const y = cy - i * gap;
    ctx.save();
    ctx.translate(0, -(1 - local) * 10);
    chipObj(ctx, { cx, cy: y, size, thick, alpha: alpha * local, pinCount: 0, inner: false, glow: 10 });
    ctx.restore();
  }
  return { size };
}


export function cubeObj(ctx, o) {
  const { cx, cy, size = 160, height = 220, alpha = 1, stroke = PAL.lime, fill = PAL.ink } = o;
  const h = size / 1.732;
  const A = iso(-h, -h, height), B = iso(h, -h, height), C = iso(h, h, height), D = iso(-h, h, height);
  const A0 = iso(-h, -h, 0), B0 = iso(h, -h, 0), C0 = iso(h, h, 0), D0 = iso(-h, h, 0);
  const p = (pt) => [cx + pt[0], cy + pt[1]];
  poly(ctx, [p(A0), p(B0), p(B), p(A)], { fill, stroke, alpha });
  poly(ctx, [p(B0), p(C0), p(C), p(B)], { fill, stroke, alpha });
  poly(ctx, [p(A), p(B), p(C), p(D)], { fill, stroke, alpha });
}

// 2D panel with a lime 1px frame (labels, screens, counters)
export function panel(ctx, x, y, w, h, o = {}) {
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = o.fill ?? "rgba(10,18,7,0.85)";
  if (o.fill !== null) ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = o.stroke ?? PAL.lime;
  ctx.lineWidth = o.lw ?? 1.1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}
