#!/usr/bin/env node
// One command for the self-review pass: validate, then produce the images the
// agent (and the user) must actually look at before any video is encoded.
//
//   node verify.mjs film.json [--outdir stills]
//
// Writes: <outdir>/storyboard.png (all shots, labelled) + <outdir>/full-*.png
// Exits 1 if check.mjs finds a problem, so nothing is rendered from a bad plan.

import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const filmPath = argv.find((a) => !a.startsWith("--"));
const oi = argv.indexOf("--outdir");
const outDir = oi >= 0 ? argv[oi + 1] : "stills";
if (!filmPath) {
  console.error("usage: node verify.mjs film.json [--outdir stills]");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
const film = JSON.parse(readFileSync(filmPath, "utf8"));
const total = (film.shots ?? []).reduce((a, s) => a + (s.dur ?? 3), 0);

const run = (args, label) => {
  console.log(`\n== ${label}`);
  return spawnSync(process.execPath, args, { stdio: "inherit", cwd: process.cwd() });
};

// 1. the plan must be valid before anything is rendered
const check = run([join(HERE, "check.mjs"), filmPath], "check");
if (check.status !== 0) {
  console.log("\nstop: the plan has errors above. Fix them, then run verify again.");
  process.exit(1);
}

// 2. every shot on one labelled sheet
run([join(HERE, "render.mjs"), filmPath, "--sheet", "--outdir", outDir], "storyboard sheet");

// 3. three full-size frames spread across the film
const marks = [0.28, 0.55, 0.82].map((f) => (f * total).toFixed(1)).join(",");
run([join(HERE, "render.mjs"), filmPath, "--stills", marks, "--outdir", join(outDir, "full")], "full-size frames");

console.log(`
== now look, do not assume
open: ${join(outDir, "storyboard.png")}   (every shot, with its caption)
open: ${join(outDir, "full")}/         (full size, ${marks}s)

tick each one before you render:
  [ ] every caption is complete and inside the frame - nothing cut off at the edge
  [ ] every drawing is the thing its caption is about (a dog looks like a dog)
  [ ] nothing overlaps: labels on art, art on captions, HUD on art
  [ ] no shot is a dead frame (blank, or too little on screen to read)
  [ ] the film tells the topic's story in order, not the demo's
  [ ] the aspect and palette match the reference (near-black, one lime accent, red only for loss)

any box you cannot tick: change film.json (shorten the caption, move the element,
redraw the sprite, add a shot) and run this again. Do not render video until all
six are ticked.`);
