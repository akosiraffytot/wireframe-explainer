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

1. **Phase A — plan.** Write a six-chapter story (hook → context → mechanism →
   cost → turn → answer), one idea per shot. Put it in `storyboard.md`
   (`examples/storyboard.template.md`), transcribe it to `film.json`, then render
   `node render.mjs film.json --sheet --outdir stills` and **show the user
   `stills/storyboard.png` and stop for approval**.
2. **Phase B — build.** `node verify.mjs film.json` (refuses demo copies, bad
   scenes, text that cannot fit, missing sprites) → look at the sheet and frames
   it writes and tick its six boxes → `node render.mjs film.json out/film.mp4`,
   or `node build.mjs out/film.mp4 ...` for a long film.
3. No template fits? `tpl: "compose"` + primitives (list in `reference.md`), not a
   wrong template. No primitive for the object (dog, machine, dragon)? Draw it in
   `sprites.json` and prove it with `node sprite.mjs check` + `proof`, then look.

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
build.mjs       renders a long film in parts and concatenates
sprite.mjs      author/proof/check hand-drawn sprites (characters, objects)
verify.mjs      check + storyboard sheet + full-size frames, with the review checklist
lib/            dot-matrix type, iso primitives, 16 scene templates, canvas loader
examples/       a 17-shot worked example
scripts/        install.sh
media/          rendered demo (not needed at runtime)
```
