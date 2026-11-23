#!/usr/bin/env bash
# Install the wireframe-explainer skill into a project.
#
#   bash scripts/install.sh                # install into the current directory
#   bash scripts/install.sh ../my-project
#
# It copies the skill to <project>/.agents/skills/wireframe-explainer and warms
# the one native dependency (@napi-rs/canvas). Re-running it updates the copy.
set -euo pipefail

NAME="wireframe-explainer"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-$PWD}"

say() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

case "${1:-}" in -h|--help) sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0;; esac

command -v node >/dev/null 2>&1 || die "node is required (18 or newer) - https://nodejs.org"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "node 18 or newer required (found $(node -v))"
command -v ffmpeg >/dev/null 2>&1 || die "ffmpeg is required on PATH - https://ffmpeg.org"

[ -d "$TARGET" ] || die "no such directory: $TARGET"
TARGET="$(cd "$TARGET" && pwd)"
DEST="$TARGET/.agents/skills/$NAME"

if [ "$SRC" = "$DEST" ]; then
  say "already installed at $DEST"
else
  mkdir -p "$DEST"
  for f in SKILL.md reference.md render.mjs check.mjs build.mjs package.json lib examples scripts; do
    [ -e "$SRC/$f" ] && cp -R "$SRC/$f" "$DEST/"
  done
  say "installed -> $DEST"
fi

say "node $(node -v), ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3)"

# warm the canvas dependency so the first render is not slowed down by an install
if ( cd "$DEST" && node -e 'import("./lib/load-canvas.mjs").then(()=>console.log("canvas: ready"))' ); then :; else
  say "warning: could not load @napi-rs/canvas yet; render.mjs will retry the install"
fi

say ""
say "next:"
say "  1. node \"$DEST/render.mjs\" \"$DEST/examples/containers.film.json\" --stills --outdir stills"
say "  2. write film.json for your topic, then: node \"$DEST/render.mjs\" film.json out/film.mp4"
say "  3. or tell your agent: read $DEST/SKILL.md and follow it"
