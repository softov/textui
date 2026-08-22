#!/usr/bin/env bash
#
# Build (or serve) the docs site in Docker.
#
# There is no Ruby on the Linux workstation and no reason to put one there:
# the site is Jekyll, everything else in this repo is Node, and the one thing
# a local Ruby would buy is the one thing a container already gives.
#
#   scripts/docs-site.sh          build once into docs/_site
#   scripts/docs-site.sh serve    build and serve on :4000, watching
#
# Runs as the calling user so nothing comes back root-owned, and keeps the gem
# bundle in docs/vendor - which, with _site/ and .jekyll-cache/, is already in
# docs/.gitignore.
#
# Ruby 3.4 because nothing is pinned and the Gemfile's csv/base64/bigdecimal
# entries are there for 3.4+. Expect Sass deprecation warnings from inside
# just-the-docs 0.12 itself (`darken()`, `map-get`); they are not ours and are
# not fatal.
set -euo pipefail

cd "$(dirname "$0")/.."
DOCS="$PWD/docs"

[ -d "$DOCS" ] || { echo "no docs/ directory at $DOCS" >&2; exit 1; }

if [ "${1:-build}" = "serve" ]; then
  cmd="bundle install --quiet && bundle exec jekyll serve --host 0.0.0.0 --livereload"
  ports=(-p 4000:4000 -p 35729:35729)
  echo "serving on http://localhost:4000$(grep -m1 '^baseurl:' "$DOCS/_config.yml" | sed 's/baseurl: *//;s/"//g')"
else
  cmd="bundle install --quiet && bundle exec jekyll build"
  ports=()
fi

# `-it` only when there is a terminal to attach: without the guard this fails
# outright under CI, a pipe, or an agent.
tty=()
[ -t 0 ] && tty=(-it)

exec docker run --rm "${tty[@]}" \
  -v "$DOCS:/srv" -w /srv \
  -u "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e BUNDLE_PATH=/srv/vendor/bundle \
  "${ports[@]}" \
  ruby:3.4 bash -c "$cmd"
