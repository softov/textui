#!/usr/bin/env bash
# Build or serve the docs site without installing Ruby.
#
# Everything runs in a throwaway ruby:3.3 container. Gems land in
# docs/vendor/bundle (gitignored) so the second run is fast, and the container
# runs as you rather than root so nothing it writes needs sudo to delete.
#
#   scripts/docs-serve.sh          serve at http://localhost:4000/textui/
#   scripts/docs-serve.sh --build  build once into docs/_site, then exit
set -euo pipefail

docs="$(cd "$(dirname "${BASH_SOURCE[0]}")/../docs" && pwd)"
base=$(sed -n 's/^baseurl:[[:space:]]*//p' "$docs/_config.yml" | tr -d '"' | head -1)

run() {
  docker run --rm "$@" \
    -v "$docs:/site" -w /site \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp -e BUNDLE_PATH=/site/vendor/bundle \
    ruby:3.3 bash -lc "bundle install --quiet && $CMD"
}

if [[ "${1:-}" == "--build" ]]; then
  CMD="bundle exec jekyll build --trace"
  run -i
  echo "built -> docs/_site"
else
  CMD="bundle exec jekyll serve --host 0.0.0.0 --livereload --force_polling"
  echo "serving http://localhost:4000${base}/  (ctrl-c to stop)"
  run -it -p 4000:4000 -p 35729:35729
fi
