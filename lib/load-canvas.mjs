// Resolve @napi-rs/canvas from wherever it happens to be, and install it once if
// it is nowhere. This is what lets the skill be copied out of the project that
// had node_modules and still run.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const bases = [
  join(SKILL_DIR, "package.json"),           // deps installed in the skill folder
  process.env.WIREFRAME_CANVAS_ROOT && join(process.env.WIREFRAME_CANVAS_ROOT, "package.json"),
  join(process.cwd(), "package.json"),       // the project you run from
  join(SKILL_DIR, "..", "..", "..", "package.json"), // <project>/.agents/skills/<name>
].filter(Boolean);

function tryLoad() {
  for (const base of bases) {
    if (!existsSync(base)) continue;
    try {
      return createRequire(base)("@napi-rs/canvas");
    } catch {
      /* keep looking */
    }
  }
  try {
    return createRequire(import.meta.url)("@napi-rs/canvas");
  } catch {
    return null;
  }
}

let mod = tryLoad();
if (!mod) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  console.error("canvas: @napi-rs/canvas not found, installing it into the skill folder once...");
  try {
    execFileSync(npm, ["install", "--no-save", "--no-audit", "--no-fund", "--prefix", SKILL_DIR, "@napi-rs/canvas"], {
      stdio: "inherit",
    });
  } catch {
    console.error("canvas: npm install failed. Install node and run:  npm i @napi-rs/canvas");
    process.exit(1);
  }
  mod = tryLoad();
  if (!mod) {
    console.error("canvas: still cannot load @napi-rs/canvas after installing it.");
    process.exit(1);
  }
}

export const { createCanvas, GlobalFonts } = mod;
export default mod;
