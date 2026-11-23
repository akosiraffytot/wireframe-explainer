# Reference: what the original video measures, and what each template does

Source: `out/ref/` — a 178 s, 720×1280, 30 fps, 65-shot explainer. Verdict from
rea-video: **code / template render, 100 %** (no footage, no AI video, no 3D
renderer: flat fills, 1-2 px glowing strokes, procedural isometric grid).

## Measured

| | |
|---|---|
| Canvas | 720 × 1280 (9:16), 30 fps |
| Shots | 65 in 178.1 s, mean **2.74 s**, shortest 0.07 s, longest 5.3 s |
| Cutting | 21.6 cuts / min, hard cuts only (a couple of dissolves) |
| Caption lines | 287 lines, **median 1.2 s** each, one line on screen at a time |
| Caption type | bold sans (Helvetica/Arial), uppercase, cap height 45 px → **62 px** |
| Caption position | block top 0.767 H, bottom ≈ 0.805 H (single line); two rows start at 0.74 H |
| Caption colours | white body, **lime keywords**, red for the negative beat |
| Caption entrance | hard in 163×, fade 26×, scale pop 24×, type-on 7× |
| HUD | dot-matrix, 44 px badge at (44, 52), 19 px label under it, six 42×6 px ticks |
| Labels | dot-matrix 20-34 px, white/grey, floating next to the diagram |
| Background | `#040605` with a radial `#0d1a08` vignette, iso grid at alpha 0.16 |

Palette: `#9FDD4E` lime · `#FFFFFF` / `#EDEFEA` white · `#8C918C` grey ·
`#E3485A` red · `#0A1207` fill · `#2E451F` deep green line.

Motion grammar: objects scale/fade in over 0.45 s; stacks assemble bottom-up at
≈0.12 s per layer; counters tick over 1.2-1.6 s with ease-out; a walker walks at
constant speed; a sweep bar crosses a pixel field once; rings draw on clockwise;
captions swap with a 120 ms 1.06→1 scale pop. Nothing rotates for show, the
camera never moves; the shot is carried by the caption changing.

## Templates

All props are optional; the defaults are the reference's most common setup.
`lines` is always the shot's caption.

| `tpl` | Draws | Useful props |
|---|---|---|
| `compare` | two objects side by side, labels + meters, optional red slash or ban plane | `labels:[l,r]`, `meters:[0..1,0..1]`, `meterLabel`, `slash`, `ban`, `tower:false`, `sizeA/sizeB`, `cy` |
| `chip` | one chip die with callouts, optional rings or rays | `size`, `callouts:[{text,value,dx,dy}]`, `rings:n`, `rays`, `cx`, `cy` |
| `stack` | a tower assembling layer by layer | `layers`, `size`, `gap`, `callouts:[{text,dx,dy}]` |
| `grid` | dense field of small dots, a few lit, optional counter | `cols`, `rows`, `lit:[i]`, `litCount`, `counter:{from,to}`, `y` |
| `chart` | bars or a line chart | `bars:[{v,color,label}]` or `type:"line",points:[...],tag:"−90%"`, `dashTo` |
| `road` | isometric road ribbon with a walker and floating tags | `length`, `width`, `tags:[{text,x,y,size}]`, `walker:false`, `figureH`, `cx`, `cy` |
| `pixels` | pixel matrix, optional white sweep | `cols`, `rows`, `cell`, `sweep`, `counter:{to}` |
| `lattice` | isometric lattice of chips with links | `n`, `step`, `chipSize`, `counter:{from,to}` |
| `rack` | isometric cabinet of GPUs + red cable curves | `cols`, `rows`, `cell`, `cables:false`, `glowStrip`, `cx`, `cy` |
| `rings` (via `chip`) | concentric iso rings around a chip | `rings:n` |
| `icons` | row of icon tiles with ticks and crosses | `items:[{kind:"box"|"gpu"|"dot",state:"yes"|"no"}]`, `y` |
| `monitor` | CRT monitor with typed screen text, optional eye | `screen:"line1\n> line2"`, `eye`, `w`, `h`, `cy` |
| `textwall` | wall of dot-matrix words + optional big number | `cols`, `rows`, `words:[...]`, `big:{from,to}` |
| `people` | stick figures: one, a crowd, a queue, a hand-off | `count`, `queue`, `handoff`, `h`, `y`, `tag` |
| `dots` | sparse field of dots, a few lit (headcount, survivors) | `lit:[i]`, `cols`, `rows`, `cell`, `fade` |
| `card` | empty beat with a big dot-matrix word | `big`, `bigSize`, `frame` |

### Composing a shot no template covers

`tpl: "compose"` with `props.elements` — an ordered list, array order = draw
order. Element props: `at:[x,y]` (anchor in px), `t0` (local seconds it appears),
`reveal` (duration, default 0.45), plus the primitive's own props.

| prim | draws | main props |
|---|---|---|
| `chip` | a chip die, optionally with pins and an inner die | `size, thick, color, inner, pins` |
| `stack` | a tower of layers | `size, layers, gap, build` |
| `box` | an upright iso box / cabinet | `size, height, color` |
| `rings` | concentric iso rings | `n, r0, gap, color` |
| `figure` | stick figure, feet at `at` | `h, walk, arms` |
| `label` | dot-matrix label, top-left at `at` | `text, size, color` |
| `word` | big dot-matrix word, centred | `text, size, glow` |
| `text` | bold caption-font text | `text, size, color, bg, w` |
| `badge` | boxed label | `text, size, w, h` |
| `meter` | horizontal meter | `w, h, value, caption` |
| `bars` | bar chart | `values[], labels[], colors[], bw, gap, maxH` |
| `linechart` | line chart | `points[], w, h, color` |
| `dots` | dot field with lit indices | `cols, rows, cell, lit[]` |
| `tiles` | square tile grid | `cols, rows, cell, fill` |
| `arrow` | connector with head | `from, to, dash, head` |
| `callout` | leader line + label | `from, text, size` |
| `counter` | ticking number | `from, to, prefix, suffix` |
| `panel` | framed rectangle / screen | `w, h, fill` |
| `lattice` | iso lattice of chips with links | `n, step, chip, links` |
| `cross` / `check` | red X / lime tick | `size` |
| `sprite` | hand-drawn character or object | `asset` \| `lines` \| `circles` \| `d`, `box, lw, glow, motion:"bob"\|"drift"\|"pulse", flip, fill` |

### Sprites: drawing what the catalog does not have

Grid is 100x100, stroke-only, feet/base near y=88 so everything shares one ground
line. `box` is how many px the 100-grid covers (`box: 300` → a 300px character).
Built-ins: `dog`, `washer`, `dragon`. Anything else goes in `sprites.json` beside
the film:

```json
{ "rocket": { "lines": [
  [[50,6],[63,32],[60,70],[40,70],[37,32],[50,6]],
  [[40,70],[50,84],[60,70]],
  [[37,55],[27,65]],
  [[63,55],[73,65]]
], "circles": [[50,46,9]] } }
```

| want | do |
|---|---|
| a shape you can describe as points | `lines`: array of polylines, `[x,y]` in the 0-100 grid |
| something round (drum, eye, wheel) | `circles`: `[cx, cy, r]` |
| an existing SVG outline | `d`: raw path data, same grid |
| it must feel alive while on screen | `motion: "bob"` (vertical), `"drift"` (sideways), `"pulse"` (scale) |

`node sprite.mjs check sprites.json` fails blank/dash/off-grid/one-stroke/duplicate
sprites; `node sprite.mjs proof sprites.json` writes a labelled contact sheet that
must be looked at. A sprite above 86 % IoU with another is treated as a look-alike
and refused.

### Text limits

Captions auto-shrink to 90 % of frame width but are meant to stay at 62px:
2-4 words, ≤15 characters, max 18. `check.mjs` reports the real pixel width of
every caption, annot, chapter label and in-scene label, so overflow is a number
before it is a rendering surprise. Safe horizontal band for in-scene text: 60-660.

Shot-level extras: `annot` (dot-matrix line, top centre), `big` ({text,y,size}),
`gridCell`, `gridAlpha`, `gridY`, `grid:false` to drop the ground grid,
`enter:"hard"|"fade"|"pop"`, `fade:true`.

## Writing the six chapters

The reference runs a company history, but the arc is generic:

1. **THE QUESTION** – a wordless visual paradox in the first 6 s (small thing vs
   big thing, before vs after). Two shots at most.
2. **STEP 1/2 · CONTEXT** – where this came from, one fact per shot.
3. **STEP 3 · MECHANISM** – the machinery: 2-4 shots that build, assemble, or
   connect something.
4. **STEP 4 · THE COST** – the price of it: bars, a falling line, a loss.
5. **STEP 5 · THE TURN** – the reversal; red allowed here.
6. **THE ANSWER** – one number and one noun, then a quiet final card.

Each chapter changes the HUD badge (a year, or a count) and advances one tick.

## QA checklist before shipping

- Every caption line is ≤ 15 characters and ≤ 4 words; nothing wraps oddly.
- No label overlaps a diagram edge; nothing important sits below y = 0.72 H
  (the caption zone) or above y = 0.16 H (the HUD zone).
- Each shot has exactly one object of attention.
- Red appears at most 3-4 times in the whole film.
- Shot lengths stay between 1.5 and 4.5 s; nothing is a still for longer than
  the captions need.
- The mp4 is 720×1280 at 30 fps and the duration matches the sum of `dur`.
- For long films: parts render in order, each part is reviewable on its own, and
  the HUD badge changes at act boundaries, not mid-part.
