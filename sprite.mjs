#!/usr/bin/env node
// Author, proof and flop-check hand-drawn sprites (characters, objects).
//
//   node sprite.mjs check sprites.json        # geometry + duplicate check, exit 1 on a flop
//   node sprite.mjs proof sprites.json        # contact sheet to LOOK AT before you use them
//   node sprite.mjs check sprites.json --name dog
//
// A sprite is line art on a 100x100 grid: { lines: [[[x,y],...]], circles: [[cx,cy,r]], d?: "M..." }
// feet / base sit near y=88 so it can stand on the same ground line as everything else.

import { createCanvas, Path2D } from "./lib/load-canvas.mjs";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PAL, background } from "./lib/draw.mjs";
import { label, labelWidth } from "./lib/draw.mjs";
import { setPath2D, PRIMS } from "./lib/primitives.mjs";
import { SPRITES, loadSprites } from "./lib/sprites.mjs";

setPath2D(Path2D);

const [mode, file] = process.argv.slice(2);
const flags = {};
process.argv.slice(2).forEach((a, i, arr) => {
  if (a.startsWith("--")) flags[a.slice(2)] = arr[i + 1]?.startsWith("--") ? true : arr[i + 1];
});
if (!mode || !file) {
  console.error("usage: node sprite.mjs check|proof sprites.json [--name NAME] [--out proof.png]");
  process.exit(2);
}
loadSprites([file]);
const defs = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const names = Object.keys(defs).filter((k) => !k.startsWith("_") && defs[k]);
if (!names.length) {
  console.error(`sprite: no sprites in ${file}`);
  process.exit(1);
}

// ---- rasterise one sprite to an ink mask, straight from the real renderer
function maskOf(def, px = 64) {
  const cv = createCanvas(px, px);
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, px, px);
  PRIMS.sprite(ctx, { at: [px / 2, px / 2], box: px * 0.92, lw: 2, glow: 0, ...def }, 0, 1);
  const d = ctx.getImageData(0, 0, px, px).data;
  const m = new Uint8Array(px * px);
  for (let i = 0; i < px * px; i++) m[i] = d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] > 90 ? 1 : 0;
  return m;
}
function iou(a, b) {
  let i = 0, u = 0;
  for (let k = 0; k < a.length; k++) {
    if (a[k] || b[k]) u++;
    if (a[k] && b[k]) i++;
  }
  return u ? i / u : 0;
}
function bbox(m, px = 64) {
  let x0 = px, y0 = px, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    if (m[y * px + x]) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { n, cov: n / (px * px), w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ---- check
if (mode === "check") {
  let bad = 0;
  const masks = {};
  for (const [name, def] of Object.entries(SPRITES)) masks[name] = maskOf(def);
  for (const name of names) {
    const def = defs[name];
    const m = masks[name];
    const bb = bbox(m);
    const strokes = (def.lines?.length ?? 0) + (def.circles?.length ?? 0) + (def.d ? 1 : 0);
    const pts = [...(def.lines ?? []).flat(), ...(def.circles ?? []).map((c) => [c[0], c[1]])];
    const oob = pts.filter(([x, y]) => x < -2 || x > 102 || y < -2 || y > 102).length;
    const issues = [];
    if (bb.cov < 0.005) issues.push(`almost nothing drawn (ink ${(bb.cov * 100).toFixed(1)}% of the box)`);
    if (bb.h < 14) issues.push(`only ${bb.h}/64 tall - reads as a dash, not "${name}"`);
    if (oob) issues.push(`${oob} point(s) outside the 0-100 grid (drawing will clip)`);
    if (strokes < 3) issues.push(`only ${strokes} stroke(s) - too little to be recognisable`);
    let twin = null, best = 0;
    for (const [other, om] of Object.entries(masks)) {
      if (other === name) continue;
      const s = iou(m, om);
      if (s > best) { best = s; twin = other; }
    }
    if (best > 0.86) issues.push(`${(best * 100).toFixed(0)}% identical to "${twin}" - a look-alike, not a new character`);
    const shape = `ink ${(bb.cov * 100).toFixed(0)}% · ${bb.w}x${bb.h} · ${strokes} strokes · nearest ${twin ?? "-"} ${(best * 100).toFixed(0)}%`;
    if (issues.length) {
      bad++;
      console.log(`x ${name}  ${shape}`);
      issues.forEach((s) => console.log(`    - ${s}`));
    } else {
      console.log(`ok ${name}  ${shape}`);
    }
  }
  if (bad) {
    console.log(`\n${bad} sprite(s) will read as a blob. Fix the coordinates, then run: node sprite.mjs proof ${file}`);
    process.exit(1);
  }
  console.log(`\nall ${names.length} sprite(s) pass the geometry check. Now LOOK at them: node sprite.mjs proof ${file}`);
}

// ---- proof sheet
if (mode === "proof") {
  const cols = Math.min(4, names.length);
  const cell = 300, head = 34;
  const rows = Math.ceil(names.length / cols);
  const cv = createCanvas(cols * cell, rows * (cell + head));
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#040605";
  ctx.fillRect(0, 0, cv.width, cv.height);
  names.forEach((name, i) => {
    const cx = (i % cols) * cell, cy = Math.floor(i / cols) * (cell + head);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx + 4, cy + 4, cell - 8, cell - 8);
    ctx.clip();
    ctx.translate(cx, cy + head);
    background(ctx, cell, cell, 0);
    ctx.strokeStyle = "rgba(159,221,78,0.10)";
    ctx.lineWidth = 1;
    for (let g = 0; g <= 100; g += 10) {
      ctx.beginPath(); ctx.moveTo((g / 100) * cell, 0); ctx.lineTo((g / 100) * cell, cell); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (g / 100) * cell); ctx.lineTo(cell, (g / 100) * cell); ctx.stroke();
    }
    PRIMS.sprite(ctx, { at: [cell / 2, cell * 0.54], box: cell * 0.86, ...SPRITES[name] }, 0.6, 1);
    ctx.restore();
    ctx.fillStyle = "#0b1409";
    ctx.fillRect(cx, cy, cell, head);
    ctx.fillStyle = PAL.lime;
    ctx.font = "bold 16px Consolas, monospace";
    ctx.fillText(name.toUpperCase(), cx + 8, cy + 22);
    ctx.fillStyle = "rgba(237,239,234,0.5)";
    ctx.font = "11px Consolas, monospace";
    const bb = bbox(maskOf(SPRITES[name]));
    ctx.fillText(`${bb.w}x${bb.h} of 100`, cx + cell - 84, cy + 22);
  });
  const out = flags.out ?? join("stills", "sprites.png");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, cv.toBuffer("image/png"));
  console.log(`wrote ${out} (${names.length} sprites). Look at it: is each one the thing its name says, without the caption?`);
}
