#!/usr/bin/env node
// Validate a film.json before you render it, and print the storyboard so a human
// (or the agent itself) can check the content is about the user's topic.
//
//   node check.mjs film.json
//   node check.mjs film.json --allow-demo     # for smoke-testing the demo itself
//
// Exits 1 on a hard problem: bad template, absurd duration, or a film that is
// still the demo with new words.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { templates } from "./lib/scenes.mjs";
import { PRIM_NAMES } from "./lib/primitives.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEMO = join(HERE, "examples", "containers.film.json");

const file = process.argv[2];
const allowDemo = process.argv.includes("--allow-demo");
if (!file) {
  console.error("usage: node check.mjs film.json [--allow-demo]");
  process.exit(2);
}
if (!existsSync(file)) {
  console.error(`error: no such file: ${file}`);
  process.exit(2);
}

const film = JSON.parse(readFileSync(file, "utf8"));
const errors = [];
const warnings = [];
const norm = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");

const shots = Array.isArray(film.shots) ? film.shots : [];
if (shots.length < 4) errors.push(`only ${shots.length} shots: a film needs a story, not a clip (4+)`);

const tplNames = Object.keys(templates);
let total = 0;
const rows = [];

shots.forEach((s, i) => {
  const n = i + 1;
  const dur = Number(s.dur ?? 0);
  total += dur;
  const tpl = s.tpl ?? "card";
  if (!tplNames.includes(tpl)) errors.push(`shot ${n}: unknown template "${tpl}"`);
  let tplLabel = tpl;
  if (tpl === "compose") {
    const els = s.props?.elements ?? [];
    tplLabel = `compose[${els.length}]`;
    if (!els.length) errors.push(`shot ${n}: compose scene has no props.elements`);
    els.forEach((el, k) => {
      if (!PRIM_NAMES.includes(el.prim)) {
        errors.push(`shot ${n}: element ${k + 1} uses unknown primitive "${el.prim}" (have: ${PRIM_NAMES.join(", ")})`);
      }
      if (!el.at && !el.from && !el.to) warnings.push(`shot ${n}: element ${k + 1} (${el.prim}) has no at/from/to - it may draw off-frame`);
    });
    if (els.length > 14) warnings.push(`shot ${n}: ${els.length} elements is busy for one idea`);
  }
  if (!(dur > 0)) errors.push(`shot ${n}: dur missing`);
  else if (dur < 0.5 || dur > 8) errors.push(`shot ${n}: dur ${dur}s is outside 0.5-8s`);
  else if (dur < 1.2 || dur > 5) warnings.push(`shot ${n}: dur ${dur}s is unusual (1.2-5s is the reference range)`);
  const lines = (s.lines ?? []).map((l) => (typeof l === "string" ? l : l.text ?? ""));
  if (!lines.length) errors.push(`shot ${n}: no caption lines`);
  if (lines.length > 3) warnings.push(`shot ${n}: ${lines.length} caption lines, 1-3 keeps it readable`);
  lines.forEach((l) => {
    if (l.length > 18) errors.push(`shot ${n}: caption "${l}" is ${l.length} chars (max 18, aim 15)`);
    else if (l.length > 15) warnings.push(`shot ${n}: caption "${l}" is long (${l.length} chars)`);
    if (l.split(/\s+/).length > 5) warnings.push(`shot ${n}: caption "${l}" has too many words`);
  });
  if (film.chapters && s.ch != null && (s.ch < 0 || s.ch >= film.chapters.length)) {
    errors.push(`shot ${n}: ch ${s.ch} has no chapter`);
  }
  rows.push({ n, t: total.toFixed(1), ch: s.ch ?? "-", tpl: tplLabel, lines: lines.join(" / "), dur: dur.toFixed(1) });
});

// ---- is this still the demo?
if (existsSync(DEMO)) {
  const demo = JSON.parse(readFileSync(DEMO, "utf8"));
  const isDemoFile = resolve(file) === resolve(DEMO);
  const demoLines = new Set();
  const demoShots = new Set();
  demo.shots.forEach((s) => {
    const ls = (s.lines ?? []).map((l) => (typeof l === "string" ? l : l.text ?? ""));
    demoShots.add(`${s.tpl}|${ls.map(norm).join("|")}`);
    ls.forEach((l) => demoLines.add(norm(l)));
  });
  let identical = 0;
  let shared = 0;
  let all = 0;
  shots.forEach((s) => {
    const ls = (s.lines ?? []).map((l) => (typeof l === "string" ? l : l.text ?? ""));
    if (demoShots.has(`${s.tpl}|${ls.map(norm).join("|")}`)) identical++;
    ls.forEach((l) => {
      all++;
      if (demoLines.has(norm(l))) shared++;
    });
  });
  const ratio = all ? shared / all : 0;
  if (!allowDemo && !isDemoFile) {
    if (identical > 0) {
      errors.push(
        `${identical} shot(s) are identical to the demo (same template and caption): write the story from the user's brief, not from examples/containers.film.json`,
      );
    }
    if (ratio > 0.25) {
      errors.push(
        `${shared}/${all} caption lines (${Math.round(ratio * 100)}%) are copied from the demo: the demo is a shape reference, its words are not your script`,
      );
    } else if (ratio > 0) {
      warnings.push(`${shared}/${all} caption lines also appear in the demo (${Math.round(ratio * 100)}%) - check they are genuinely right for this topic`);
    }
    const demoBadges = (demo.chapters ?? []).map((c) => c.badge).join(",");
    const badges = (film.chapters ?? []).map((c) => c.badge).join(",");
    if (demoBadges && demoBadges === badges) {
      warnings.push(`chapter badges are the demo's (${demoBadges}) - is that really this topic's timeline?`);
    }
  }
}

// ---- report
console.log(`\n${file}`);
console.log(`${shots.length} shots | ${total.toFixed(1)}s | ${((shots.length / Math.max(1, total)) * 60).toFixed(0)} cuts/min\n`);
const w = (s, n) => String(s).padEnd(n);
console.log(w("#", 3) + w("at", 7) + w("ch", 4) + w("template", 11) + w("dur", 6) + "captions");
console.log("-".repeat(78));
rows.forEach((r) => console.log(w(r.n, 3) + w(r.t, 7) + w(r.ch, 4) + w(r.tpl, 13) + w(r.dur, 6) + r.lines));
console.log("");

if (warnings.length) {
  console.log(`${warnings.length} warning(s):`);
  warnings.forEach((x) => console.log(`  ! ${x}`));
  console.log("");
}
if (errors.length) {
  console.log(`${errors.length} error(s):`);
  errors.forEach((x) => console.log(`  x ${x}`));
  console.log("\nfix these before rendering.");
  process.exit(1);
}
console.log("ok - storyboard reads clean. Next: --stills, look at them, then render.");
