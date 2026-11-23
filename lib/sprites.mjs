// Starter line-art silhouettes, authored on a 100x100 grid, feet/base near y=88.
// Stroke-only on purpose: they read as wireframes, the same language as the
// diagrams, so a character never looks pasted in from another film.
// Anything not here can be built inline with `lines`, `circles` or a raw `d` path.
export const SPRITES = {
  dog: {
    lines: [
      [[26, 50], [70, 48], [73, 56], [73, 64], [30, 66], [26, 58], [26, 50]],
      [[70, 48], [77, 44], [84, 38], [92, 40], [98, 44], [93, 48], [84, 48], [78, 50]],
      [[82, 37], [86, 28], [91, 36]],
      [[34, 66], [32, 86], [25, 87]],
      [[68, 64], [70, 86], [77, 87]],
      [[27, 51], [19, 45], [14, 36], [16, 29]],
    ],
    circles: [[89, 42, 1.5]],
  },
  washer: {
    lines: [
      [[24, 26], [76, 26], [76, 86], [24, 86], [24, 26]],
      [[24, 40], [76, 40]],
      [[60, 30], [70, 30], [70, 35], [60, 35], [60, 30]],
      [[30, 86], [30, 90]],
      [[70, 86], [70, 90]],
      [[76, 79], [84, 74], [87, 66]],
      [[43, 59], [46, 56], [52, 56], [56, 60]],
    ],
    circles: [[50, 64, 17], [50, 64, 12], [33, 33, 3.5], [45, 33, 3.5]],
  },
  dragon: {
    lines: [
      // head wedge, open jaw, swept horn
      [[10, 44], [22, 38], [30, 42], [24, 48], [12, 49], [10, 44]],
      [[12, 49], [6, 51]],
      [[22, 37], [16, 27]],
      // neck
      [[28, 43], [38, 48], [44, 52]],
      // body
      [[44, 52], [62, 54], [68, 64], [54, 70], [42, 64], [38, 56], [44, 52]],
      // folded wing: sail + two struts
      [[46, 52], [52, 28], [70, 40], [66, 50], [52, 54], [46, 52]],
      [[52, 28], [59, 51]],
      [[52, 28], [65, 47]],
      // tail, with a spade tip
      [[54, 69], [74, 72], [86, 66], [91, 55], [87, 47]],
      [[87, 47], [94, 43]],
      // legs
      [[44, 66], [40, 84], [33, 86]],
      [[58, 68], [60, 84], [67, 86]],
      // spines
      [[40, 48], [42, 41], [45, 48]],
      [[50, 51], [53, 44], [56, 52]],
      [[58, 53], [61, 47], [64, 54]],
      // breath
      [[8, 50], [3, 46], [1, 51], [5, 53]],
    ],
    circles: [[19, 43, 1.3]],
  },
};

// Project sprites: anything the script needs that the built-ins do not cover.
// A plain JSON file, so an agent can author, proof and reuse it:
//   { "cat": { "lines": [[[x,y],...]], "circles": [[cx,cy,r]] } }
// Grid is 100x100, feet/base near y=88, stroke-only line art.
import { existsSync, readFileSync } from "node:fs";

export function loadSprites(paths = []) {
  const added = [];
  for (const p of paths) {
    if (!p || !existsSync(p)) continue;
    try {
      const data = JSON.parse(readFileSync(p, "utf8"));
      for (const [name, def] of Object.entries(data)) {
        if (name.startsWith("_")) continue;
        if (!def || (!def.lines?.length && !def.circles?.length && !def.d)) continue;
        SPRITES[name] = def;
        added.push(name);
      }
    } catch (e) {
      console.error(`sprites: could not read ${p}: ${e.message}`);
    }
  }
  return added;
}
