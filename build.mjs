#!/usr/bin/env node
// Build a long film: render in parts, then concatenate. Each part is a normal
// film.json, so a 2-hour piece is just many parts rendered back to back.
//
//   node build.mjs out/film.mp4 film.json                  # one part
//   node build.mjs out/film.mp4 film.json --parts 4        # split into 4 parts
//   node build.mjs out/film.mp4 act1.json act2.json act3.json
//   node build.mjs out/film.mp4 film.json --music bed.mp3
//
// Parts are written to <outdir>/.parts/ and kept (pass --clean to remove them).

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = {};
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const k = args[i].slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith("--") && k !== "clean") { flags[k] = next; i++; } else flags[k] = true;
  } else files.push(args[i]);
}
if (files.length < 2) {
  console.error("usage: node build.mjs out/film.mp4 film.json [more.json ...] [--parts N] [--music bed.mp3] [--clean]");
  process.exit(2);
}
const out = files.shift();
const outDir = dirname(resolve(out));
const partsDir = join(outDir, ".parts");
mkdirSync(partsDir, { recursive: true });

// ---- load inputs and (optionally) split into parts
const chunks = [];
for (const f of files) {
  const film = JSON.parse(readFileSync(f, "utf8"));
  const want = files.length === 1 && flags.parts ? Math.max(1, parseInt(flags.parts, 10)) : 1;
  if (want === 1) {
    chunks.push({ film, label: basename(f, ".json") });
    continue;
  }
  const shots = film.shots;
  const totalDur = shots.reduce((a, s) => a + (s.dur ?? 3), 0);
  const target = totalDur / want;
  let acc = 0, cur = [], n = 1;
  shots.forEach((s, i) => {
    cur.push(s);
    acc += s.dur ?? 3;
    const last = i === shots.length - 1;
    if ((acc >= target * n && n < want) || last) {
      chunks.push({ film: { ...film, shots: cur }, label: `${basename(f, ".json")}-part-${String(n).padStart(2, "0")}` });
      cur = [];
      n++;
    }
  });
}

const total = chunks.reduce((a, c) => a + c.film.shots.reduce((x, s) => x + (s.dur ?? 3), 0), 0);
console.log(`${chunks.length} part(s), ${total.toFixed(1)}s total -> ${out}`);

// ---- render each part
const rendered = [];
chunks.forEach((c, i) => {
  const jsonPath = join(partsDir, `${c.label}.json`);
  const mp4Path = join(partsDir, `${c.label}.mp4`);
  writeFileSync(jsonPath, JSON.stringify(c.film, null, 1));
  const dur = c.film.shots.reduce((a, s) => a + (s.dur ?? 3), 0);
  console.log(`\n[${i + 1}/${chunks.length}] ${c.label}: ${c.film.shots.length} shots, ${dur.toFixed(1)}s`);
  const r = spawnSync(process.execPath, [join(HERE, "render.mjs"), jsonPath, mp4Path], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`part ${i + 1} failed (exit ${r.status}); stopping so the good parts are kept`);
    process.exit(r.status ?? 1);
  }
  rendered.push(mp4Path);
});

// ---- concatenate
if (rendered.length === 1) {
  const list1 = join(partsDir, "list.txt");
  writeFileSync(list1, `file '${rendered[0].replace(/\\/g, "/")}'\n`);
}
const list = join(partsDir, "list.txt");
writeFileSync(list, rendered.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n") + "\n");
const ffArgs = ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list];
if (flags.music) ffArgs.push("-i", flags.music, "-c:a", "aac", "-b:a", "160k", "-shortest");
ffArgs.push("-c:v", "copy", "-movflags", "+faststart", out);
console.log(`\nconcatenating ${rendered.length} part(s)...`);
const ff = spawnSync("ffmpeg", ffArgs, { stdio: "inherit" });
if (ff.status !== 0) process.exit(ff.status ?? 1);

console.log(`done: ${out} (${total.toFixed(1)}s, ${chunks.reduce((a, c) => a + c.film.shots.length, 0)} shots)`);
if (flags.clean) {
  rmSync(partsDir, { recursive: true, force: true });
  console.log("parts removed");
} else {
  console.log(`parts kept in ${partsDir}`);
}
