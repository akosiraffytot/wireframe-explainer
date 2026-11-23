# wireframe-explainer — for agents

This repository is an **agent skill**: a style engine that renders a
9:16 explainer video (near-black canvas, lime isometric wireframe diagrams,
dot-matrix HUD, bold captions) from a small JSON storyboard. No video model, no
footage, no API keys. Node + ffmpeg only.

## Install into the current project (one command)

```bash
git clone https://github.com/akosiraffytot/wireframe-explainer /tmp/wireframe-explainer
bash /tmp/wireframe-explainer/scripts/install.sh .
```

That copies the skill to `./.agents/skills/wireframe-explainer` and prepares its
single native dependency. Node 18+ and ffmpeg must be on PATH.

If you cannot run scripts, copy `SKILL.md`, `reference.md`, `render.mjs`, `lib/`,
`examples/` and `package.json` into `./.agents/skills/wireframe-explainer/`
yourself — nothing else is required.

## Then

Read `SKILL.md` and follow it. The short version:

1. Write a six-chapter story (hook → context → mechanism → cost → turn → answer),
   one idea per shot.
2. Express it as `film.json` (schema in `SKILL.md`, worked example in
   `examples/containers.film.json`).
3. `node check.mjs film.json` — prints the storyboard, refuses a demo copy.
4. `node render.mjs film.json --stills --outdir stills` and **look at the stills**.
5. `node render.mjs film.json out/film.mp4` and check it with `ffprobe`.

`reference.md` carries the measured style spec (shot length, caption timing,
palette, template catalog). Do not invent your own metrics: use those.

## Rules that matter

- **The demo is a shape, never a script.** `examples/containers.film.json` is a
  1956 shipping-container film: copy its structure, never its captions. Do not
  answer a video request by rendering it. Write `storyboard.md` from the user's
  brief first, then `film.json`, then `node check.mjs film.json` (it fails a
  film that is still the demo).
- Captions are 2-4 words per line, uppercase, white with one lime keyword.
- Mean shot length 2.7 s; hard cuts only; the caption advances *inside* the shot.
- One accent colour (lime). Red only for failure or loss.
- Everything is drawn from code: never add photos, logos, footage or AI video.

## Layout

```
SKILL.md        the skill (frontmatter + workflow)
reference.md    measurements + template catalog
render.mjs      film.json -> mp4, or --stills for QA
check.mjs       validates a film.json + prints the storyboard; blocks demo copies
lib/            dot-matrix type, iso primitives, 16 scene templates, canvas loader
examples/       a 17-shot worked example
scripts/        install.sh
media/          rendered demo (not needed at runtime)
```
