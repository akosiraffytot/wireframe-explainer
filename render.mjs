#!/usr/bin/env node
// Render a film.json into an mp4 in the green-wireframe explainer style.
//
//   node render.mjs film.json out.mp4
//   node render.mjs film.json out.mp4 --music bed.mp3
//   node render.mjs film.json --stills 3,12.5 --outdir stills
//
// Every shot is one template + a HUD chapter + 2-5 caption lines.

import { createCanvas, Path2D } from "./lib/load-canvas.mjs";
import { setPath2D } from "./lib/primitives.mjs";
import { loadSprites } from "./lib/sprites.mjs";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { PAL, background, isoGrid } from "./lib/draw.mjs";
import { hud, annot, captions, templates, setSize } from "./lib/scenes.mjs";
import { dotText, measure } from "./lib/dotfont.mjs";

const argv = process.argv.slice(2);
const filmPath = argv[0];
if (!filmPath) {
  console.error("usage: node render.mjs film.json [out.mp4] [--stills t1,t2] [--music file]");
  process.exit(1);
}
const flags = {};
for (let i = 1; i < argv.length; i++) {
  if (argv[i].startsWith("--")) {
    const k = argv[i].slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { flags[k] = next; i++; } else flags[k] = true;
  }
}const out = argv[1] && !argv[1].startsWith("--") ? argv[1] : "out.mp4";

const film = JSON.parse(readFileSync(filmPath, "utf8"));
const W = film.size?.[0] ?? 720;
const H = film.size?.[1] ?? 1280;
const FPS = film.fps ?? 30;
setSize(W, H);
setPath2D(Path2D);

// project sprites: characters/objects authored for this script (see sprite.mjs)
const spriteDirs = [dirname(resolve(filmPath)), process.cwd()];
const addedSprites = loadSprites([...new Set(spriteDirs.map((d) => join(d, "sprites.json")))]);
if (addedSprites.length) console.log(`sprites: ${addedSprites.join(", ")}`);

const total = film.shots.reduce((a, s) => a + (s.dur ?? 3), 0);
console.log(`film: ${film.shots.length} shots, ${total.toFixed(1)}s @ ${FPS}fps ${W}x${H}`);

function drawFrame(ctx, t) {
  background(ctx, W, H);
  // find the shot
  let acc = 0, shot = null, local = 0, idx = 0;
  for (let i = 0; i < film.shots.length; i++) {
    const d = film.shots[i].dur ?? 3;
    if (t < acc + d || i === film.shots.length - 1) { shot = film.shots[i]; local = t - acc; idx = i; break; }
    acc += d;
  }
  const tpl = templates[shot.tpl ?? "card"];
  if (!tpl) throw new Error(`unknown template: ${shot.tpl} (have: ${Object.keys(templates).join(", ")})`);
  if (shot.grid !== false) {
    isoGrid(ctx, W, H, { cell: shot.gridCell ?? 58, alpha: shot.gridAlpha ?? 0.16, cy: shot.gridY ?? H * 0.6 });
  }
  ctx.save();
  if (shot.fade) {
    const d = shot.dur ?? 3;
    ctx.globalAlpha = Math.min(1, Math.min(local / 0.3, (d - local) / 0.3 + 0.2));
  }
  tpl(ctx, shot, local, W, H);
  ctx.restore();
  // big dot-matrix word / top annotation
  if (shot.big) {
    const sz = shot.big.size ?? 66;
    const ap = Math.min(1, local / 0.35);
    const w = measure(shot.big.text.toUpperCase(), (sz / 7) * 1.36);
    dotText(ctx, shot.big.text, (W - w) / 2, shot.big.y ?? H * 0.28, { size: sz, color: shot.big.color ?? PAL.lime, alpha: ap, glow: 18 });
  }
  if (shot.annot) annot(ctx, shot.annot.text ?? shot.annot, { y: shot.annot.y ?? H * 0.175, size: shot.annot.size, color: shot.annot.color });
  hud(ctx, film.chapters?.[shot.ch ?? 0]);
  captions(ctx, shot, local);
  // film fade in / out
  if (t < 0.25) {
    ctx.save();
    ctx.globalAlpha = 1 - t / 0.25;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (total - t < 0.6) {
    ctx.save();
    ctx.globalAlpha = 1 - (total - t) / 0.6;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  return { shot, idx, local };
}

// ---- storyboard sheet mode (one frame per shot, labelled, for approval)
if (flags.sheet) {
  const dir = flags.outdir ?? ".";
  mkdirSync(dir, { recursive: true });
  const cols = 4;
  const cw = 360, ch = 640, gap = 6, head = 38;
  const rows = Math.ceil(film.shots.length / cols);
  const sheet = createCanvas(cols * (cw + gap) + gap, rows * (ch + head + gap) + gap);
  const sctx = sheet.getContext("2d");
  sctx.fillStyle = "#000";
  sctx.fillRect(0, 0, sheet.width, sheet.height);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  let acc = 0;
  film.shots.forEach((sh, i) => {
    const t = acc + (sh.dur ?? 3) * 0.78;
    drawFrame(ctx, t);
    const cx = gap + (i % cols) * (cw + gap);
    const cy = gap + Math.floor(i / cols) * (ch + head + gap);
    sctx.drawImage(canvas, cx, cy + head, cw, ch);
    sctx.fillStyle = "#0b1409";
    sctx.fillRect(cx, cy, cw, head);
    sctx.fillStyle = "#9FDD4E";
    sctx.font = "bold 14px Consolas, monospace";
    const cap = (sh.lines ?? []).map((l) => (typeof l === "string" ? l : l.text)).join(" / ");
    sctx.fillText(`#${i + 1} · ${(sh.dur ?? 3).toFixed(1)}s · ${sh.tpl ?? "card"}`, cx + 6, cy + 15);
    sctx.fillStyle = "rgba(237,239,234,0.7)";
    sctx.font = "11px Consolas, monospace";
    sctx.fillText(cap.slice(0, 58), cx + 6, cy + 30);
    acc += sh.dur ?? 3;
  });
  const outPath = `${dir}/${flags.name ?? "storyboard"}.png`;
  writeFileSync(outPath, sheet.toBuffer("image/png"));
  console.log(`wrote ${outPath}  (${film.shots.length} shots, ${cols} per row)`);
  process.exit(0);
}

// ---- stills mode (QA: look at one frame per shot)
if (flags.stills) {
  const times = flags.stills === true
    ? film.shots.map((_, i) => film.shots.slice(0, i).reduce((a, s) => a + (s.dur ?? 3), 0) + (film.shots[i].dur ?? 3) * 0.75)
    : String(flags.stills).split(",").map(Number);
  const dir = flags.outdir ?? "stills";
  mkdirSync(dir, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  times.forEach((t, i) => {
    drawFrame(ctx, t);
    const p = `${dir}/still_${String(i).padStart(2, "0")}_${t.toFixed(2)}.png`;
    writeFileSync(p, canvas.toBuffer("image/png"));
    console.log("wrote", p);
  });
  process.exit(0);
}

// ---- video mode
const ffArgs = [
  "-y", "-loglevel", "error",
  "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
];
if (flags.music) ffArgs.push("-i", flags.music, "-c:a", "aac", "-b:a", "160k", "-shortest");
ffArgs.push("-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out);
mkdirSync(dirname(resolve(out)), { recursive: true });
const ff = spawn("ffmpeg", ffArgs, { stdio: ["pipe", "inherit", "inherit"] });

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
const frames = Math.round(total * FPS);
const t0 = Date.now();
let n = 0;
const write = (buf) =>
  new Promise((res) => {
    if (ff.stdin.write(buf)) res();
    else ff.stdin.once("drain", res);
  });

for (let f = 0; f < frames; f++) {
  drawFrame(ctx, f / FPS);
  await write(canvas.data());
  n++;
  if (n % 150 === 0) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`  ${n}/${frames} frames  ${(n / el).toFixed(1)} fps\n`);
  }
}
ff.stdin.end();
ff.on("close", (code) => {
  console.log(`done: ${out} (${n} frames, ${((Date.now() - t0) / 1000).toFixed(1)}s, exit ${code})`);
});
